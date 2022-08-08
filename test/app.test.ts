// You can import your modules
// import index from '../src/index'
//import express from 'express';
import nock from 'nock';
// Requiring our app implementation
import myProbotApp from '../src/app';
//const myProbotApp = require('../src/app');
import { Probot, ProbotOctokit } from 'probot';
import { assert } from 'console';
//import { realpathSync } from 'fs';
//import { REPL_MODE_SLOPPY } from 'repl';
// Requiring our fixtures
// const fs = require('fs');
// const path = require('path');
//const express = require('express');

const fixtureIssueCreated = require("./fixtures/issues.opened");
const issueCreatedBody = { body: "This is a test" };

// const privateKey = fs.readFileSync(
//   // path.join(__dirname, 'copilot-ops.2022-07-27.private-key.pem'),
//   // 'utf-8'
//   path.join('copilot-ops.2022-07-27.private-key.pem'),
//   'utf-8'
// );

// function getRouter(_path?: string): express.Router { 
//   return express.Router();
// }

describe('My Probot app', () => {
  let probot: any;

  beforeEach(() => {
    //const app = express();
    nock.disableNetConnect();
    probot = new Probot({
      appId: 1,
      //privateKey,
      githubToken: "test",
      // disable request throttling and retries for testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });
    //probot = myProbotApp
    // Load our app into probot
    //myProbotApp(probot);
    probot.load(myProbotApp)
    // const app = probot.load(myProbotApp);
    // app.app = () => 'test';
  });
  
  test("creating an issue", async() => {

    console.log('woahh im inside the test');

    // mock a request
    nock("https://api.github.com")
      .post("/app/installations/2/access_tokens")
      .reply(200, { token: "test" });

    nock("https://api.github.com")
      .post("/repos/djach7/testbot/issues/3/comments", (body) => {
        expect(body).toMatchObject(issueCreatedBody);
        return true;
      })
      .reply(200);
      
    await probot.receive({ name: 'issues', payload: fixtureIssueCreated });
  });

  // test("posting a comment", async() => {
  //   nock("https://api.github.com")
  //     .post("/app/installations/2/access_tokens")
  //     .reply(200, { token: "test" });

  //   nock("https://api.github.com")
  //     .post("/repos/djach7/testbot/issues/3/comments", (body) => {
  //       expect(body).toMatchObject(issueCreatedBody);
  //       return true;
  //     })
  //     .reply(200);

  //   await probot.receive({ name: "issues", payload: fixtureIssueCreated });
  // });

  
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
