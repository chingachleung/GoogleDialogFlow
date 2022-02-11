'use strict';

//import * as admin from "firebase-admin"
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const { WebhookClient } = require('dialogflow-fulfillment');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

const api_key = '<YOU API KEY>';
const https = require('https');


exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));


  // English handler functions and intent map
  function welcome(agent) {
    agent.add(`Welcome to DMV Metro! How can I help you?`);
  }
  function callMetroApi (agent) {
    return new Promise((resolve, reject) => {
        let homeStation = agent.parameters.home;
        let destinationStation = agent.parameters.destination;
        let output = 'at least one of the stations provided is not valid';
        getStationCode(homeStation).then((homeStationCode) => {
            console.log(`the value from getStation function for home station is ${homeStationCode}`);
            getStationCode(destinationStation).then((destinationStationCode) =>{
                console.log(`the value from getStation function for destination station is ${destinationStationCode}`);
                if (homeStationCode != null && destinationStationCode != null){
                    output = `there is not train that goes directly from ${homeStation} to ${destinationStation}`;
                    https.get(`https://api.wmata.com/StationPrediction.svc/json/GetPrediction/${homeStationCode}?api_key=${api_key}`, (res) => {
                        let body = ''; // var to store the response chunks
                        res.on('data', (d) => { body += d; }); // store each response chunk
                        res.on('end', () => {
                            // After all the data has been received parse the JSON for desired data
                            body = JSON.parse(body);
                            let trainPredictions = body.Trains;
                            let metroLineColor = trainPredictions[0].Line;
                            let predictionLength = Object.keys(trainPredictions).length;
                            let stationsInPath =[];
                            let directionCode;
                            let minutes;
                            getLineEndStations(metroLineColor).then((stationList) =>{
                                getPath(stationList[0], stationList[1]).then((path) => {
                                    let pathLength = Object.keys(path).length;
                                    for (let j=0;j<pathLength;j++){
                                        //return the path of the corresponding line
                                        stationsInPath.push(path[j].StationCode);
                                    }
                                    if (stationsInPath.indexOf(destinationStationCode)> stationsInPath.indexOf(homeStationCode)){
                                        directionCode = stationList[1];
                                    }
                                    else{
                                        directionCode =stationList[0];
                                    }
                                    for (let i=0;i<predictionLength;i++){
                                        if (trainPredictions[i].DestinationCode == directionCode){

                                            minutes = trainPredictions[i].Min;
                                            if (minutes === "ARR") {
                                                output = `the train is arriving now`;
                                            }
                                            else if (minutes === "BRD" ){
                                                output = `the train is boarding passengers now`;
                                            }
                                            else{
                                                output = `the next train to ${destinationStation} will arrive in ${minutes} minutes`;
                                            }
                                            break;

                                        }else {
                                            console.log(`prediction${i} does not match `);
                                            continue;
                                        }
                                    }
                                    //console.log(`see if it goes to this line ${output}`);
                                  	agent.add(output);
                                    resolve(output);
    
                                });

                            });
                        });
                        res.on('error', (error) => {
                        //agent.add('the code is not working');
                        //console.log(`Error calling the API: ${error}`);
                        agent.add(`Error calling the API: ${error}`);
                        reject();
                        });
                    });
                }else{
                    //console.log(`printing out the last else statment ${output}`);
                  	agent.add(output);
                    resolve(output);
                }                
            });
        });
    });
}

  function getStationCode (station) {
      return new Promise((resolve, reject) => {

      // Make the HTTP request to get station list 
          https.get(`https://api.wmata.com/Rail.svc/json/jStations?api_key=${api_key}`, (res) => {
              let body = ''; // var to store the response chunks
              res.on('data', (d) => { body += d; }); // store each response chunk
              res.on('end', () => {
              // After all the data has been received parse the JSON for desired data
              body = JSON.parse(body);
              //let stations = JSON.stringify(body.Stations);
              let new_obj = body.Stations;
              //let len = Object.keys(new_obj).length;
              let objectLength = Object.keys(new_obj).length;

              let stationCode = null; 
              for (let i = 0; i < objectLength; i++) {
                  //console.log(`in the loop ${i}`);
                  if (new_obj[i].Name.toLowerCase() === station.toLowerCase()) {
                      //console.log(new_obj[i].Name)
                      stationCode = new_obj[i].Code;
                      //console.log(stationCode);
                      break;
                  }
              }
              let output = stationCode;
              resolve(output);
              });
              res.on('error', (error) => {
              //agent.add('the code is not working');
              console.log(`Error calling the API: ${error}`);
              reject();
              });
          });
      });
  }


  function getPath (homeStationCode, endPointCode) {
      return new Promise((resolve, reject) => {

      // Make the HTTP request to get station list 
          https.get(`https://api.wmata.com/Rail.svc/json/jPath?FromStationCode=${homeStationCode}&ToStationCode=${endPointCode}&api_key=${api_key}`, (res) => {
              let body = ''; // var to store the response chunks
              res.on('data', (d) => { body += d; }); // store each response chunk
              res.on('end', () => {
              // After all the data has been received parse the JSON for desired data
              body = JSON.parse(body);
              //let stations = JSON.stringify(body.Stations);
              let new_obj = body.Path;
              let objectLength = Object.keys(new_obj).length;
              console.log(`printing pathlength inside the fuction ${objectLength}`);
              let output = new_obj;

              resolve(output);
              });
              res.on('error', (error) => {
              //agent.add('the code is not working');
              console.log(`Error calling the API: ${error}`); //could make it a agent.add()...
              reject();
              });
          });
      });
  }

  function getLineEndStations (lineColor) {
      return new Promise((resolve, reject) => {

      // Make the HTTP request to get station list 
          https.get(`https://api.wmata.com/Rail.svc/json/jLines?api_key=${api_key}`, (res) => {
              let body = ''; // var to store the response chunks
              res.on('data', (d) => { body += d; }); // store each response chunk
              res.on('end', () => {
              // After all the data has been received parse the JSON for desired data
              body = JSON.parse(body);
              //let stations = JSON.stringify(body.Stations);
              let new_obj = body.Lines;
              let objectLength = Object.keys(new_obj).length;
              console.log(`printing pathlength inside the fuction ${objectLength}`);
              let endStationCode;
              let startStationCode;
              let currentLine;
              let outputList = [];
              for (let i=0; i<objectLength;i++){
                  currentLine = new_obj[i];
                  if (currentLine.LineCode == lineColor) {
                      startStationCode = currentLine.StartStationCode;
                      endStationCode = currentLine.EndStationCode;
                      outputList.push(startStationCode, endStationCode);
                      resolve(outputList);
                  }
              }
              //let output = new_obj

              resolve('no line information is found');
              });
              res.on('error', (error) => {
              //agent.add('the code is not working');
              console.log(`Error calling the API: ${error}`); //could make it a agent.add()...
              reject();
              });
          });
      });
  }

	
  function SaveHomeStation(agent) {
    agent.add(`Should be saving home bro`);
    if (agent.getSignInStatus() === agent.SignInStatus.OK) {
    let accessToken = agent.getUser().accessToken;
  	} else {
    agent.tell('You need to sign-in before using the app.');
  	}
  }

  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }
  let IntentMap = new Map(); // Map functions to English Dialogflow intent names
  IntentMap.set('Default_Welcome_Intent', welcome);
  //IntentMap.set('user_wants_info_4',getTimeHandler2);
  IntentMap.set('Default_Fallback_Intent', fallback);
  IntentMap.set('user_sets_home__2', SaveHomeStation);
  IntentMap.set('user_wants_info_4',callMetroApi);

  agent.handleRequest(IntentMap);
});
