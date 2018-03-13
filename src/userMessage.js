const { DF_KEY, GOOGLE_API_1, GOOGLE_API_2 } = require('../config');
const apiai = require('apiai');
const request = require('request');
const saveConversation = require('./database/queries/save_conversation');
const saveMessage = require('./database/queries/save_message');

const app = apiai(DF_KEY);

const apiaiCall = (req, res, speech) => {
  saveMessage(speech, req.body.uniqueId);
  const requestdf = app.textRequest(speech, {
    sessionId: req.body.uniqueId,
  });

  requestdf.on('response', (response) => {
    const lookup = {
      DivorceIndia: 'A2:B',
      DivorcePakistan: 'C2:D',
      DivorceItaly: 'E2:F',
      DivorceUK: 'G2:H',
      DivorceGlobal: 'I2:J',
    };
    const { messages } = response.result.fulfillment;
    const data = {
      speech: messages[0].speech,
      options: [],
      resources: [],
      selectOptions: [],
      retrigger: '',
      timedelay: '',
    };

    // console.log error because conversation should continue even if it can't be saved to database
    saveMessage(data.speech, response.sessionId);

    const payload = messages[1] ? messages[1].payload : {};
    if (!payload.timedelay) {
      data.timedelay = 'fast';
    } else {
      data.timedelay = payload.timedelay;
    }

    if (payload.retrigger) {
      data.retrigger = payload.retrigger;
    }

    if (payload.resources) {
      const cellRef = lookup[payload.resources];
      const url = GOOGLE_API_1 + cellRef + GOOGLE_API_2;
      request(url, (err, gsres, body) => {
        if (JSON.parse(body).error || err) {
          data.resources = [{ text: 'Chayn Website', href: 'www.chayn.co' }];
          data.retrigger = '';
          data.speech = "Sorry there's a problem getting the information, please check the Chayn website or try again later";
          res.send(data);
        } else {
          const resourceArray = JSON.parse(body).values.map(resource => ({
            text: resource[0],
            href: resource[1],
          }));
          data.resources = [...resourceArray];
          res.send(data);
        }
      });
    } else {
      data.options = payload.options ? [...payload.options] : data.options;
      data.selectOptions = payload.selectOptions ? [...payload.selectOptions] : data.selectOptions;
      res.send(data);
    }
  });

  requestdf.on('error', () => {
    const data = {
      options: [],
      selectOptions: [],
      timedelay: '',
      resources: [{ text: 'Chayn Website', href: 'www.chayn.co' }],
      retrigger: '',
      speech: "I'm really sorry but I can't chat right now due to technical problems, please check the Chayn website for any information you are looking for or try again later",
    };
    res.send(data);
  });

  requestdf.end();
};

const userMessage = (req, res) => {
  const { speech } = req.body;
  apiaiCall(req, res, speech);
  saveConversation(req.body.uniqueId);
};

module.exports = userMessage;
