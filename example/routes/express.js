const querystring = require('querystring');

const { urlencoded } = require('express'); // eslint-disable-line import/no-unresolved

const Account = require('../support/account');

const body = urlencoded({ extended: false });

const bodyParser = require('body-parser');
const parse = bodyParser.urlencoded({ extended: false });

var accountId;
var rememeber;

module.exports = (app, provider) => {
  const { constructor: { errors: { SessionNotFound } } } = provider;

  app.use((req, res, next) => {
    const orig = res.render;
    // you'll probably want to use a full blown render engine capable of layouts
    res.render = (view, locals) => {
      app.render(view, locals, (err, html) => {
        if (err) throw err;
        orig.call(res, '_layout', {
          ...locals,
          body: html,
        });
      });
    };
    next();
  });

  function setNoCache(req, res, next) {
    res.set('Pragma', 'no-cache');
    res.set('Cache-Control', 'no-cache, no-store');
    next();
  }

  app.get('/interaction/:grant', setNoCache, async (req, res, next) => {
    try {
      const details = await provider.interactionDetails(req);
      const client = await provider.Client.find(details.params.client_id);

      if (details.interaction.error === 'login_required') {
        return res.render('login', {
          client,
          details,
          title: 'Sign-in',
          params: "",
          interaction: ""
        });
      }
      var promptedScopes = details.params.scope
      promptedScopes = promptedScopes.split(" ")
      var index = promptedScopes.indexOf('openid')
      promptedScopes.splice(index, 1)
      return res.render('interaction', {
        client,
        details,
        title: 'Authorize',
        params: promptedScopes,
        interaction: ""
      });
    } catch (err) {
      return next(err);
    }
  });

  app.post('/interaction/:grant/login', parse, async (req, res, next) => {
    console.log('authentice called from express.js');
    console.log('********');


    const details = await provider.interactionDetails(req);
    const client = await provider.Client.find(details.params.client_id);
    console.log('******** details, clients fetched');
    Account.authenticate(req.body.login, req.body.password)
      .then(
        (response) => {
          accountId = response.accountId
          remember = req.body.remember
          var promptedScopes = details.params.scope
          promptedScopes = promptedScopes.split(" ")
          var index = promptedScopes.indexOf('openid')
          promptedScopes.splice(index, 1)
          console.log("paramScope", promptedScopes)
          console.log("remember", details.params.scope)
          res.render('interaction', {
            client,
            details,
            title: 'Authorize',
            params: promptedScopes,
            interaction: ""
          })
        }

      ).catch(
        next);
  });

  app.post('/interaction/:grant/login', setNoCache, body, async (req, res, next) => {
    try {
      // await provider.interactionFinished(req, res, result);
      console.log("reeeeeeee", req.body)
      console.log("/interaction/:grant/login error called")
      const details = await provider.interactionDetails(req);
      const client = await provider.Client.find(details.params.client_id);
      console.log("*******/interaction/:grant/login params: ", details.params)
      console.log("*******/interaction/:grant/login interaction: ", details.interaction)
      return res.render('login_error', {
        client,
        details,
        title: 'Sign-in',
        params: 'Email ort password is wrong',
        params: querystring.stringify(details.params, ',<br/>', ' = ', {
          encodeURIComponent: value => value,
        }),
        interaction: querystring.stringify(details.interaction, ',<br/>', ' = ', {
          encodeURIComponent: value => value,
        }),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/interaction/:grant/confirm', parse, (req, res, next) => {
    var allScopes = req.body.allScopes;
    allScopes = allScopes.split(",");
    console.log("all Scopes", allScopes)
    var selectedScopess = req.body.params;
    console.log("selected scope", selectedScopess)
    var loginRememberScope = remember ? ['offline_access'] : [];
    var rejectedScopes = selectedScopess ? allScopes.filter((el) => !selectedScopess.includes(el)) : allScopes;
    rejectedScopes = rejectedScopes.concat(loginRememberScope)
    console.log("rejectedScopes", rejectedScopes);
    provider.interactionFinished(req, res, {
      login: {
        account: accountId,
        remember: !!rememeber,
        ts: Math.floor(Date.now() / 1000),
      },
      consent: {
        rejectedScopes: rejectedScopes,
      },
    }).catch(next)
  });

  app.use((err, req, res, next) => {
    if (err instanceof SessionNotFound) {
      // handle interaction expired / session not found error
    }
    next(err);
  });
};
