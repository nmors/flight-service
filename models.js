'use strict' 
const P = require('bluebird')
const R = require('ramda')
const request = require('request');

// This will convert an object o request parameters needed to send to the services api
// e.g. /flight_search/QF?date=2016-09-02&from=SYD&to=JFK'  &   /airports?q=Melbourne'
const buildQueryParameters = params => {
  if (!params) return '';
  let str = "?";
  for (let key in params) {
    if (str != "?") str += "&";
    str += key + "=" + encodeURIComponent(params[key]);
  }
  return str;
}

// Creates a model based on a HTTP service as it's data source 
const createServiceModel = m => {
	return {
    search(params, urlSuffix) {
      return new P(resolve => {
        const myRequestEndpoint = m.baseURL + m.endpoint + (urlSuffix ? '/' + urlSuffix : '')
        const myRequestURL = myRequestEndpoint + (params ? buildQueryParameters(params) : '')
        request(myRequestURL, (err, response, payload) => {
          try {
            payload = JSON.parse(payload);
          } catch (e) {
            return resolve({err: {message: `Could not parse response from ${myRequestURL} service`, code: 502, data: payload}})
          }
          if (err || response.statusCode !== 200) return resolve({err})
          return resolve({resp: m.spec(payload)})
        })
      })
    },
    // Not implemented:
    delete(id) {}, 
    update(id, data) {}, 
    insert(data) {}  
	}
}


// Creates a model based on the 'code-task' API as it's data source 
const createFlightServicesModel = m => {
  return createServiceModel({
    baseURL: 'http://node.locomote.com/code-task',
    endpoint: m.endpoint,
    spec: m.spec || (X=>X)
  })
}


// Used to format and filter Flights data to pick out only the fields we are interested in
const flightDataSpec = R.map(
  R.pipe(
    R.applySpec({
      price: R.prop('price'),
      flightNum: R.prop('flightNum'),
      durationMin: R.prop('durationMin'),
      airlineName: R.pathOr('Unknown', ['airline', 'name']),
      departs: R.path(['start', 'dateTime']),
      arrives: R.path(['finish', 'dateTime']),
    })
   )
)

// Used to filter Airport data to pick out only the fields we are interested in
const airportDataSpec = R.map(
  R.pick([
    'airportCode',
    'airportName',
    'cityName',
    'stateCode',
    'countryName',
  ])
);


// Export the required resources as models
module.exports = {
  Airlines: createFlightServicesModel({
    endpoint: '/airlines'
  }),
  Airports: createFlightServicesModel({
    endpoint: '/airports',
    spec: airportDataSpec
  }),
  Flights: createFlightServicesModel({
    endpoint: '/flight_search',
    spec: flightDataSpec
  }),
}

