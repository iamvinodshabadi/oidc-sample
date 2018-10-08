const assert = require('assert');
const _ = require('lodash');
var Request = require('request');

const USERS = {
  '23121d3c-84df-44ac-b458-3d63a9a05497': {
    email: 'foo@example.com',
    email_verified: true,
  },
  'c2ac2b4a-2262-4e2f-847a-a40dd3c4dcd5': {
    email: 'bar@example.com',
    email_verified: false,
  },
};

class Account {
  constructor(id) {
    this.accountId = id; // the property named accountId is important to oidc-provider
  }

  // claims() should return or resolve with an object with claims that are mapped 1:1 to
  // what your OP supports, oidc-provider will cherry-pick the requested ones automatically
  claims() {
    return Object.assign({}, USERS[this.accountId], {
      sub: this.accountId,
    });
  }

  static async findById(ctx, id) {
    // this is usually a db lookup, so let's just wrap the thing in a promise, oidc-provider expects
    // one
    return new Account(id);
  }

  static async authenticate(email, password) {

    return new Promise(async (resolve, reject) => {
    console.log('authentice called from account.js');
    console.log('email is', email);
    console.log('password is', password);
    assert(password, 'password must be provided');
    assert(email, 'email must be provided');
    const lowercased = String(email).toLowerCase();
    const id = _.findKey(USERS, { email: lowercased });
    // assert(id, 'invalid credentials provided');

    console.log('making api request');

    var response = await Account.uctAuthenticate(email,password);

    console.log('return called id', response);
    if(response) {
      return resolve(new this(response));
    } else {
      return reject();
    }
    });
  } 

  static async uctAuthenticate(email, password) {
    return new Promise(async (resolve, reject) => {
      try {
        Request.post({
          "headers": { "content-type": "application/json" },
          "url": "http://localhost:9010/security/authentication/access-token",
          "body": JSON.stringify({
            "email": email,
            "password": password,
            "strategy": "local",
            "companyCode": "GB0010001",
            "bankId": "5b07e07962b26ba8a0fd3c28"
          })
        }, (error, response, body) => {
          console.log('response received', response.body);
          if (response) {
            if (response.statusCode == 201) {
              const parsedResponse = JSON.parse(response.body);
              if (parsedResponse) {
                const kvPair = {
                  
                }
                return resolve(parsedResponse.customerId);
              } else {
                return reject(401);
              }
            } else {
              return reject(err);
            }
          } else {
            return reject(err);
          }
        });
      } catch (err) {
        console.log(err);
        throw err;
      }
    });
}

}

module.exports = Account;
