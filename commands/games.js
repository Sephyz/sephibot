// Constants
const Discord = require('discord.js');
const fetch = require('node-fetch');
const gamesLogo = "https://pbs.twimg.com/profile_images/1186326995254288385/_LV6aKaA_400x400.jpg";

// Possible arguments
const gamesCommands = {
'help': 'help',
'search': 'search game_name', 
'upcoming': 'upcoming'
}
const gamesDetails = {
'help': 'Show a list of available commands',
'search': 'Search a game.',
'upcoming': 'Show a list of upcoming games'
}

// Called by bot.js when games command is given
exports.run = (client, message, pool, args) => {

	if ( args.length ) {
		const commandString = args.shift();
		if ( commandString in gamesCommands ) {
			handleGamesCommand(message, pool, commandString, args).then().catch(e => console.log(e));
		}
		else {
			message.channel.send(`Games: command ${commandString} not recognised.\nUse '!games help' for a list of available commands.`);
		}
	} 
	else {
		message.channel.send("Games: no argument found.\nUse '!games help' for a list of available commands.");
	}
}

// Asynchronous function that queries the OpenCritic api
async function handleGamesCommand(message, pool, commandString, args) {
	const paginationEmbed = require('./../plugins/pagination.js');

	// Authentication
	var bearerToken = await gamesAuthenticate(message, pool);
	if ( !bearerToken || !bearerToken.length ) {
		message.channel.send(`Setting bot authentication details for first run...`);
		bearerToken = await onAuthenticationFail(message, pool);
	}

	if ( bearerToken && bearerToken.length ) {
		var gamePages = [];

		switch(commandString.toLowerCase()) {
			case 'help':
				const embed = new Discord.MessageEmbed()
				.setTitle("Games Commands")
				.setThumbnail(gamesLogo)
				.setURL("https://opencritic.com");
				for ( const [key, value] of Object.entries(gamesCommands) ) {
					embed.addField(value,gamesDetails[key]);
				}
				message.channel.send({embeds: [embed]});

				break;
			case 'search':
				//Concatenates all remaining args to form the search prompt and make an API request to IGDB
				const searchPrompt = args.join(" ");

				if ( searchPrompt.length ) {
					// We first search the terms, parse through all the result ids (max 10), then search each id to add game info to an embed page
					var searchBody = `search "${searchPrompt}" ; 
										fields aggregated_rating,
											cover.url,
											first_release_date,
											genres.name,
											involved_companies.company.name,
											name,
											platforms.abbreviation,
											url,
											screenshots.url,
											summary;
											where version_parent = null;`;
					var searchHeaders = new fetch.Headers();
					searchHeaders.append("Client-ID", process.env.IGDB_ID);
					searchHeaders.append("Authorization", "Bearer " + bearerToken);
					var requestOptions = {
						method: 'POST',
						headers: searchHeaders,
						body: searchBody
					};

					try {
						const response = await fetch("https://api.igdb.com/v4/games/", requestOptions);
						const data = await response.json();

						if ( data && data.length ) {
							for ( var i = 0; i < data.length; ++i) {
								gamePages.push(createGameEmbed(message, data[i]));
							}
							paginationEmbed(message, gamePages, true);
						}
						else {
							message.channel.send(`Games: Couldn't find a result with the search term "${searchPrompt}"`);
						}
					} catch(err) {
						console.log(err);
					}
				}
				else {
					message.channel.send(`Games: No search terms have been given`);
				}
				break;
			case 'upcoming':
				//Display a list of upcoming games
				try {
					var searchBody = `fields date,
										game.name,
										platform.abbreviation; 
										where date > 1629309691 & 
										game.version_parent = null; 
										sort date asc; limit 200;`;
					var searchHeaders = new fetch.Headers();
					searchHeaders.append("Client-ID", process.env.IGDB_ID);
					searchHeaders.append("Authorization", "Bearer " + bearerToken);
					var requestOptions = {
						method: 'POST',
						headers: searchHeaders,
						body: searchBody
					};

					const response = await fetch("https://api.igdb.com/v4/release_dates/", requestOptions);
					const data = await response.json();

					if ( data && data.length ) {
						paginationEmbed(message, parseReleaseList(data), true);
					}
					else {
						message.channel.send(`Games: Couldn't find a list of upcoming games on IGDB"`);
					}

				} catch(err) {
					console.log(err);
				}
				break;
			case 'recent':
			default:
				break;
		}
	}
}

// Handle JSON data and embed anime/manga message here
function createGameEmbed(message, data) {

	const descrLimit = 300;
	
	// Parse through platforms, genres and companies
	var platformString = parseArrayNames(data.platforms, 'abbreviation');
	var genreString = parseArrayNames(data.genres);
	var companiesString = parseInvolvedCompanies(data.involved_companies, false, "id");
	var dateString = formatDate(data.first_release_date, true);

	// Send embed to channel
	const embed = new Discord.MessageEmbed()
	.setTitle(data.name)
	.setThumbnail(data.cover ? "https:" + data.cover.url : gamesLogo)
	.setURL(data.url ? data.url : "https://www.igdb.com/")
	.addField("Companies", companiesString.length ? companiesString : "N/A", true)
	.addField("Platforms", platformString.length ? platformString : "N/A", true)
	.addField("Release Date", dateString, true)
	.addField("Genres", genreString.length ? genreString : "N/A", true)
	.addField("Avg Rating", data.aggregated_rating ? Math.floor(data.aggregated_rating).toString() : "N/A", true)
	.addField("Description", data.summary && data.summary.trim() ? (data.summary.length > descrLimit ? data.summary.substring(0, descrLimit-3) + "..." : data.summary) : "N/A")
	.setTimestamp();

	return embed;
}

// Handle JSON data and embed upcoming/recent games tables here
function createUpcomingEmbed(list) {
	// Create embed /*
	const embed = new Discord.MessageEmbed()
	.setTitle("Upcoming Releases")
	.setThumbnail(gamesLogo)
	.setURL("https://www.igdb.com/games/coming_soon")
	.setTimestamp();

	listString = '';
	var lastDate = '';
	for ( i = 0; i < list.length; ++i) {
		if ( lastDate != list[i]['date'] ) {
			lastDate = list[i]['date'];
			if ( i > 0 ) {
				listString += "\n\n";
			}
			listString += "**" + formatDate(list[i]['date'], true) + "**";
		}

		listString += "\n" + list[i]['name'] + " (" + list[i]['platforms'] + ")";
	}
	
	embed.addField('\u200b', listString );

	return embed;
}

function parseReleaseList(data) {

	const pageLimit = 15;
	var releaseListEmbeds = [];
	var releaseListTable = [];

	var currentGameID;
	var currentGameDetails = {};

	for ( var i = 0; i < data.length; ++i ) {
		if (data[i].game ) {
			if ( data[i].game.id != currentGameID ) {
				if ( currentGameID ) {
					// No more versions of the previous game. Push it into the table and reset currentGameDetails
					releaseListTable.push(currentGameDetails);
					currentGameDetails = {};
				}
				currentGameID = data[i].game.id;
				currentGameDetails.name = data[i].game.name;
				currentGameDetails.platforms = data[i].platform.abbreviation;
				currentGameDetails.date = data[i].date;

				if ( i === data.length ) {
					releaseListTable.push(currentGameDetails);
				}
			} else {
				// Same as previous game. Just add platform
				currentGameDetails.platforms += ", " + data[i].platform.abbreviation;
			}
		}
	}

	for ( var j = 0; j < releaseListTable.length; j += pageLimit ) {
		releaseListEmbeds.push(createUpcomingEmbed(releaseListTable.slice(j, j+pageLimit-1)));
	}

	return releaseListEmbeds;
}

function parseArrayNames(list, nameKey = 'name') {

	var namesString = list ? '' : "N/A";
	if ( list && list.length ) {
		for (var i = 0; i < list.length; ++i) {
			namesString += (i > 0 ? ", " : "" ) + list[i][nameKey];
		}
	} else {
		console.log("No entries found");
	}

	return namesString;
}

function parseInvolvedCompanies(list) {

	var namesString = list ? '' : "N/A";
	if ( list && list.length ) {
		for (var i = 0; i < list.length; ++i) {
			namesString += (i > 0 ? ", " : "" ) + list[i].company.name;
		}
	} else {
		console.log("No entries found");
	}

	return namesString;
}

function formatDate(time, unix = false) {

	var date = new Date(time * (unix ? 1000 : 1));
	var dateString = 'N/A';
	if ( date.toString() != 'Invalid Date' ) {
		dateString = date.getUTCFullYear().toString() + "-" + (date.getUTCMonth()+1).toString() + "-" + date.getUTCDate().toString();
	}
	
	return dateString;
}

async function gamesAuthenticate(message, pool) {
	
	var bearerToken = '';
	const [rows,fields] = await pool.promise().query(`SELECT * FROM tokens WHERE service = 'twitch'`);

	if(rows && rows[0].bearer) {
		return rows[0].bearer;
	}
}

async function onAuthenticationFail(message, pool) {
	console.log("Games: Twitch authentication failed! Attempting to create a new token")
	var bearerToken = '';

	try {
		var authUrl = "https://id.twitch.tv/oauth2/token?client_id=" + process.env.IGDB_ID + "&client_secret=" + process.env.IGDB_SECRET + "&grant_type=client_credentials";
		const response = await fetch(authUrl, {method: 'post'});
		const data = await response.json();

		if ( data && data.access_token ) {
			bearerToken = data.access_token;
            pool.query(`UPDATE tokens SET bearer = '${bearerToken}' WHERE service = 'twitch'`);
            message.channel.send(`Games: Database authentication update complete. Please try again.`);
		} else {
			message.channel.send(`Games: Database authentication failed. Please contact the bot's dev.`);
		}

	} catch(err) {
		console.log(err);
	}

	return bearerToken;
}