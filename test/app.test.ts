// You can import your modules
// import index from '../src/index'

import nock from 'nock';
// Requiring our app implementation
import myProbotApp from '../src/app';
import { Probot, ProbotOctokit } from 'probot';
import { assert } from 'console';
//import { realpathSync } from 'fs';
//import { REPL_MODE_SLOPPY } from 'repl';
// Requiring our fixtures
const fs = require('fs');
const path = require('path');

const payload = require("./fixtures/issues.opened");
const issueCreatedBody = { body: "This is a test" };

const privateKey = fs.readFileSync(
  path.join(__dirname, 'fixtures/mock-cert.pem'),
  'utf-8'
);

describe('My Probot app', () => {
  let probot: any;

  beforeEach(() => {
    nock.disableNetConnect();
    probot = new Probot({
      appId: 123,
      privateKey,
      githubToken: "test",
      // disable request throttling and retries for testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });
    // Load our app into probot
    probot.load(myProbotApp);
  });
  
  test("posting a comment", async() => {
    nock("https://api.github.com")
      .post("/app/installations/2/access_tokens")
      .reply(200, { token: "test" });

    nock("https://api.github.com")
      .post("/repos/djach7/testbot/issues/new", (body) => {
        expect(body).toMatchObject(issueCreatedBody);
        return true;
      })
      .reply(200);

    await probot.receive({ name: "issues", payload })
  });

  
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    assert(nock.isDone())
  });
});

// For more information about testing with Jest see:
// https://facebook.github.io/jest/

// For more information about using TypeScript in your tests, Jest recommends:
// https://github.com/kulshekhar/ts-jest

// For more information about testing with Nock see:
// https://github.com/nock/nock
