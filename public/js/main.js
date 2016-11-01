'use strict'
// Author: Nathan Mors

// Create data models of what we need to request
const Airlines = function (cb) {
		$.ajax({
		  url: "/airlines"
		}).done(function(resp) {
			cb(resp)
		});
      },
      Airports = function (query, cb) {
		$.ajax({
		  url: "/airports?q=" + query
		}).done(function(resp) {
			cb(resp)
		});
      },
      // Note: urlSuffix is the :airline_code
      Flights = function (urlSuffix, params, cb) {
		if (!params) params = $('#flight-search-form').serialize()
		  $.ajax({
		    url: "/search/flight_search/" + urlSuffix + "?" + params
		  })
		  .done(function(resp) {
			cb(resp)			
		  })
      };


// Make some promises from the models functions above
const FlightsPromise = (q, params) => new P(resolve => Flights(q, params, data => resolve(data)))
const AirlinesPromise = (q) => new P(resolve => Airlines(data => resolve(data)))
const AirportsPromise = (q) => new P(resolve => Airports(q, data => resolve(data)))

// Disable the features we don 't need from the table library.
const dynatablesConfig =  { 
  features: {
    search: true,
    sort: true,
    pushState: false,
    recordCount: false,
    perPageSelect: false,	
    paginate: false,
  }
};

// Creates a data table in the `elementSelector` table element with the `data` specified
const createDataTable = (elementSelector, data) => new P(resolve => {
   $(elementSelector + ' tbody').html('');
   const dynatable = $(elementSelector).dynatable(Object.assign(dynatablesConfig, {
      dataset: {
	records: data
      }
   }));

   if (!dynatable.data('dynatable')) { 
	console.log('failed to create table ' + elementSelector)
	return resolve(); // => this will catch when the html is invalid, or table fails to create
   }
   dynatable.data('dynatable').settings.dataset.originalRecords = data;
   //dynatable.data('dynatable').settings.dataset.records = data
   //dynatable.data('dynatable').dom.update();
   dynatable.data('dynatable').process();
   return resolve(dynatable);
})

// Function to dismiss the loading indicator
//let requestFailTimer = {cancel:f=>''};
const loadingStop = () => {
	// requestFailTimer.cancel()
	$('.loading-message').fadeOut('slow', function(){
		$('.loading-message span').html('');
	})
}

// Function to show the loading indicator
const loadingStart = msg => {
	$('.loading-message span').html(msg || "Please Wait while we fetch your results.")
	$('.loading-message').fadeIn('fast')
	// requestFailTimer = P.delay(20000).then(f => $('.loading-message span').html('Oh no. This request seems to be taking longer than usual. Check your internet connection.'))
}

// returns a function that updates the dropdown list when we query for airlines
const createDropdownUpdater = v => { 
      // reset the current entries first
      $(v).html('')
      return R.pipe(
	  R.map(val => {
	    //update the list with new options
            $(v).append($('<option></option>')
		.val(val.code)
		.html(val.name)
	    )
          })
      )
}

// create an updater for the airline code
const airlineCodeDropdownUpdater = createDropdownUpdater('#airline-codes-data')

// Function to search for Airlines and populate the airline table
const searchForAirlines = P.coroutine(function*() { 
	const data = yield AirlinesPromise()
	const myTable = yield createDataTable('#airlines-data', data)
	airlineCodeDropdownUpdater(data)
	return data;
})
searchForAirlines();


// Function to search for Airports TO and populate the Airports table
const searchAirportsTo = P.coroutine(function*() { 
	if (R.isEmpty($('#flight-to').val())) return null;
	const data = yield AirportsPromise($('#flight-to').val())
	const myTable = yield createDataTable('#airports-data-to', data)
	$('.airports-to').fadeIn()
	return data;
})

// Function to search for Airports FROM and populate the Airports table
const searchAirportsFrom = P.coroutine(function*() { 
	if (R.isEmpty($('#flight-from').val())) return null;
	const data = yield AirportsPromise($('#flight-from').val())
	const myTable = yield createDataTable('#airports-data-from', data)
	$('.airports-from').fadeIn()
	// get the first result of the airport code and use it in the search
	//const validAirportCode = R.propOr($('#flight-from').val(), 'airportCode', data[0]);
	//$('#flight-from').val(validAirportCode)
	return data;
})


$( "#airports-data-to tbody" ).on( "click", "tr", function() {
  const myAirportCode = $(this).find( 'td:first' ).html();
  $('#flight-to').val(myAirportCode)

});


$( "#airports-data-from tbody" ).on( "click", "tr", function() {
  const myAirportCode = $(this).find( 'td:first' ).html();
  $('#flight-from').val(myAirportCode)
});


$( "#airlines-data tbody" ).on( "click", "tr", function() {
  $('.advanced-search-option').fadeIn();
  const myAirlineCode = $(this).find( 'td:first' ).html();
  $('#airline-code').val(myAirlineCode)
});

// This function will check all the fields have been filled in correctly, otherwise the API request(s) may fails
const validateSearchForm = () => {
	if (R.isEmpty($('#flight-from').val())) return "From Field must be filled in.";
	if (R.isEmpty($('#flight-to').val())) return "To Field must be filled in.";
	if (R.isEmpty($('#flight-date').val())) return "Date Field must be filled in.";
	if (!(moment($('#flight-date').val(), 'YYYY-MM-DD', true).isValid())) return "Date Field must be Valid."
	if (moment($('#flight-date').val()).diff(moment()) < 0) return "Date must be in the future."
	return false;
}

// Hides the search result panel
const cancelSearchResults = () => $('.flight-search-results').fadeOut()


// Function to Crete a modal used for error messages because its nicer than alert()
const displayModal = message => {
	// create the basic model element
	const modalEl = document.createElement('div');
	modalEl.style.width = '450px';
	modalEl.style.height = '350px';
	modalEl.style.margin = '100px auto';
	modalEl.style.backgroundColor = '#fff';
	mui.overlay('on', modalEl);
	// put our message in the modal
	$('#mui-overlay div').append('<i class="fa fa-exclamation-circle" aria-hidden="true"></i><br />' + message)
	// change material Z-Axis to 2 (adds a deep shadow)
	$('#mui-overlay div').addClass('mui--z2 app-overlay-div');
	// add a dismiss button
	$('#mui-overlay div').append("<br /><br /><button class=\"mui-btn mui-btn--primary mui-btn--raised\" onclick=\"dismissModal()\">OK, Got It!</button>")
}

// Closes the modal
const dismissModal = () => {
	$('#mui-overlay').fadeOut(500, function() {
		$('#mui-overlay').remove();
	});
}

// Function that calls form validation, creates an array of relevant days 
// to use for initialising the tab headings and the flight searches for all surrounding days 
const searchFlights = () => new P(resolve => {
	const validation = validateSearchForm();
	if (validation) return displayModal(validation); 
	$('.welcome-message').fadeOut();
	loadingStart('Loading Flights, Please Wait...');
	let paramObj = {};
	const parameters = $('#flight-search-form').serializeArray().map(function(x){paramObj[x.name] = x.value;}); 
	const surroundingDays = getSurroundingDays(paramObj.date);
 	const dayMap = R.map(a => {
		paramObj.date = a;
		const tabText = moment(a).format('ddd DD/MM')
		const serializedParams = $.param(paramObj)
		const tabId = "tab-day-"+surroundingDays.indexOf(a)
		$("a[data-mui-controls='"+tabId+"']").html(tabText);
		return searchFlightsThenUpdateTable(serializedParams, tabId)
	})
	P.all(dayMap(surroundingDays)).then(function(res) {
		$('.flight-search-results').fadeIn();
		loadingStop();
	});
});

// Function searches for a flight, then updates the tab results
const searchFlightsThenUpdateTable = (serializedParams, tabId) => new P(resolve => {
	FlightsPromise($('#airline-code').val(), serializedParams).then(data => resolve(createDataTable('#' + tabId + ' table', data)))
})


// Function to return a list of the surrounding days +/- 2 of the date specified
const getSurroundingDays = date => [
	moment(date).subtract(2, 'day').format('YYYY-MM-DD'),
	moment(date).subtract(1, 'day').format('YYYY-MM-DD'),
	moment(date).format('YYYY-MM-DD'),
	moment(date).add(1, 'day').format('YYYY-MM-DD'),
	moment(date).add(2, 'day').format('YYYY-MM-DD'),
]

// Handles resetting the search form to blank fields
const resetFlightSearchForm = () => {
	$("#flight-search-form input[type=text], #flight-search-form input[type=date], #flight-search-form textarea").val('')
	$('#airline-code').val('All')
	$('.airports-to, .airports-from, .flight-search-results, .advanced-search-option').fadeOut();
}

// DEPRECATED below: (moved to the server)
// This function performs a serach for the specified criteria across all available airlines
const searchFlightsAllAirlines = P.coroutine(function*(params, tab) { 
   const airlines = yield AirlinesPromise()
   const flightMap = R.map(a => FlightsPromise(a.code, params))
   const res = yield P.all(flightMap(airlines))	
   const data = R.flatten(res)
   const myTable = yield createDataTable('#tab-day-' + tab + ' table', data)
   return data;
});
