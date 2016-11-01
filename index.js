'use strict' 
const express = require('express');
const app = express();
const P = require('bluebird')
const R = require('ramda')

// Requirement: for data sources I am using  'Service Models' 
const { Airlines, Airports, Flights } = require('./models') 
const NOT_FOUND_MSG = {err: {message: 'NOT_FOUND', code: 404}} // NOTE: this can be done better

/**
 *  Requirement: Method Handler for GET /airports
 */
const searchAirports = P.coroutine(function*(req, res) {
  const {err, resp} = yield Airports.search(req.query)
  if (err) return appErrorHandler(err, req, res);
  return res.json(resp)
})

/**
 *  Requirement: Method Handler for GET /search/airlines and  GET /airlines
 */
const searchAirlines = P.coroutine(function*(req, res) {
  const {err, resp} = yield Airlines.search(req.query)
  if (err) return appErrorHandler(err, req, res);
  return res.json(resp)
})

/**
 *  Requirement: Method Handler for GET /search/flight_search/:airline_code
 */
const searchFlights = P.coroutine(function*(req, res) {
  // (if you specify 'ALL' for the airline code then we need to get all the airline codes first:)
  if (R.toLower(req.params.airline_code) === "all") {
    return searchFlightsForAllAirlines(req, res).then(resp => res.json(resp))
  }
  // Search for the flight and the airline code
  const {err, resp} = yield Flights.search(req.query, req.params.airline_code)
  if (err) return appErrorHandler(err, req, res);
  return res.json(resp) 
})

/**
 * Not a requirement but this was originally on the client but moved to 
 * the server to reduce the amount of API requests made from the UI
 */
const searchFlightsForAllAirlines = P.coroutine(function*(req, res) {
  // search for the airlines and then make an array of airline codes
  const allAirlines = yield Airlines.search(req.query)
  //const pickAirlineCodes = R.map(v => v.code)  // also works
  const pickAirlineCodes = R.map(R.path(['code']))
  const allAirlineCodes = pickAirlineCodes(allAirlines.resp);
  // create a map of promises to search across all the airlines
  const flightMap = R.map(code => Flights.search(req.query, code))
  // formats the response -picks outs the resp object
  const responseFormatter = R.pipe(
    R.map(R.path(['resp'])),
    R.flatten,
    R.reject(R.isNil)
  )
  // Query for all airlines
  const responses = yield P.all(flightMap(allAirlineCodes))
  // format the responses 
  return responseFormatter(responses)
})



/**
 *  Middleware to Handles any uncaught errors with the express server
 */
const appErrorHandler = (error, req, res, next) => {
  //if (!error) return next();
  res.status(error.code || 500);
  const pickErrFields = R.pick(['message', 'code', 'data'])
  return res.json(pickErrFields(error))
}

// Middlewares:
app.use(appErrorHandler);

// API Routes:
app.get('/airlines', searchAirlines)
app.get('/airports', searchAirports)
app.get('/search/airlines', searchAirlines)
app.get('/search/flight_search/:airline_code', searchFlights)

// FrontEnd Server:
app.use('/', express.static(__dirname + '/public'));

// Start the server:
app.listen(3000, v => console.log('flight services app started on port 3000'))
