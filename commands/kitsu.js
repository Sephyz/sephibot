// Requires
const Discord = require('discord.js');
const fetch = require('node-fetch');
const paginationEmbed = require('./../plugins/pagination.js');

// Possible arguments
const kitsuCommands = {
'help': 'help',
'anime': 'anime <optional: anime name>', 
'manga': 'manga <optional: manga name>',
'user': 'user <username>'
}
const kitsuDetails = {
'help': 'Shows a list of available commands',
'anime': 'Search an anime. If no search terms are given, a random one will be returned', 
'manga': 'Search a manga. If no search terms are given, a random one will be returned',
'user': 'Shows info about a specific kitsu user'
}

// Called by bot.js when kitsu command is given
exports.run = (client, message, pool, args) => {

	if ( args.length ) {
		const commandString = args.shift();
		if ( commandString in kitsuCommands ) {
			handleKitsuCommand(message, commandString, args).then(console.log("API Query succeeded")).catch(e => console.log(e));
		}
		else {
			message.channel.send(`Kitsu: command ${commandString} not recognised.\nUse '!**kitsu help**' for a list of available commands.`);
		}
	} 
	else {
		message.channel.send("Kitsu: no argument found.\nUse '!kitsu help' for a list of available commands.");
	}
}

// Asynchronous function that queries the Kitsu api
async function handleKitsuCommand(message, commandString, args) {

	switch(commandString.toLowerCase()) {
		case 'help':
			const embed = new Discord.MessageEmbed()
			.setTitle("Kitsu Commands")
			.setThumbnail("https://kitsu.io/kitsu-256-ed442f7567271af715884ca3080e8240.png")
			.setURL("https://kitsu.io/");
			for ( const [key, value] of Object.entries(kitsuCommands) ) {
				embed.addField(value,kitsuDetails[key]);
			}
			message.channel.send({embeds: [embed]});
			break;
		case 'anime':
		case 'manga':
			//Concatenates all remaining args to form the search prompt, if there are any
			const searchPrompt = encodeURIComponent(args.join(" "));
			if ( searchPrompt.length ) {
				var searchUrl = "https://kitsu.io/api/edge/" + commandString + "?filter[text]=" + searchPrompt + "&include=genres";

				console.log("Querying " + searchUrl);
				try {
					const response = await fetch(searchUrl);
					const data = await response.json();

					console.log("Found " + data.meta.count.toString() + " results");
					if ( data.meta.count > 0 ) {
						var embedPages = [];
						for ( var i = 0; i < Math.min(10,data.meta.count); ++i) {
							embedPages.push(createAnimeEmbed(message, commandString, data.data[i].attributes, data.included));
						}
						paginationEmbed(message, embedPages, true, 120000);
					}
					else {
						message.channel.send(`Kitsu: Couldn't find a result with the search term "${searchPrompt}"`);
					}
				} catch(err) {
					console.log(err);
				}
			}
			else {
				message.channel.send(`Kitsu: Searching a random ${commandString}`);
				console.log("Querying the api for a random result");
				try {
					// Query manga/anime for total number of entries
					const response = await fetch("https://kitsu.io/api/edge/" + commandString);
					const data = await response.json();

					// Lookup a random entry
					var randomNumber = Math.floor(Math.random() * data.meta.count);
					var randomUrl = "https://kitsu.io/api/edge/" + commandString + "?page[limit]=1&page[offset]=" + randomNumber.toString() + "&include=genres";
					console.log("Querying " + randomUrl);
					const randResponse = await fetch(randomUrl);
					const randItem = await randResponse.json();

					var randomEmbed = createAnimeEmbed(message, commandString, randItem.data[0].attributes, randItem.included, true);
					message.channel.send({embeds: [randomEmbed]});

				} catch(err) {
					console.log(err);
				}
			}
			break;
		case 'user':
			//Concatenates all remaining args to form the search prompt, if there are any
			const searchUser = encodeURIComponent(args.join(" "));
			if ( searchUser.length ) {
				var searchUrl = "https://kitsu.io/api/edge/users?filter[name]=" + searchUser + "&include=waifu,stats,favorites.item";

				console.log("Querying " + searchUrl);
				try {
					const response = await fetch(searchUrl);
					const data = await response.json();

					console.log("Found " + data.meta.count.toString() + " results");
					if ( data.meta && data.meta.count > 0 ) {
						createUserEmbed(message, commandString, data.data[0], data.included);
					}
					else {
						message.channel.send(`Kitsu: Couldn't find a user called "${searchUser}"`);
					}
				} catch(err) {
					console.log(err);
				}
			}
			else {
				message.channel.send(`Kitsu: No username has been specified.`);
			}
			break;
		default:
			break;
	}
}

// Handle JSON data and embed anime/manga message here
function createAnimeEmbed(message, type, item, genres = null, filterWarning = false) {

	const contentFilter = {
	'hentai': 1,
	'doujinshi': 2, 
	'yaoi': 3
	}

	// Parse through genre JSON
	var genreString = '';
	if ( genres != null ) {
		for (var i = 0; i < genres.length; ++i) {
			genreString += (i > 0 ? ", " : "" ) + genres[i].attributes.name;
			if ( genres[i].attributes.name.toLowerCase() in contentFilter ) {
				if ( filterWarning ) {
					message.channel.send(`Kitsu: Hentai content has been disabled, search result cannot be displayed.`);
				}
				return;
			}
		}
	} else {
		console.log("No genres found");
	}

	// Send embed to channel
	const embed = new Discord.MessageEmbed()
	.setTitle(item.canonicalTitle + " (" + (item.startDate ? item.startDate.slice(0, 4) : "N/A") + ")")
	.setThumbnail(item.posterImage.tiny)
	.setURL("https://kitsu.io/" + type + "/" + item.slug)
	.addField("Popularity Rank", item.popularityRank ? item.popularityRank.toString() : "N/A", true)
	.addField("Rating Rank", item.ratingRank ? item.ratingRank.toString() : "N/A", true)
	.addField("Approval", item.averageRating ? item.averageRating + "%" : "N/A", true)
	.addField("Genres", genreString.length ? genreString : "N/A", true)
	.addField("Age Rating", item.ageRating ? item.ageRating + (item.ageRatingGuide ? "- " + item.ageRatingGuide : "") : "N/A", true)
	.addField("Status", item.status ? item.status[0].toUpperCase() + item.status.substring(1) : "N/A", true)
	.addField("Synopsis", item.synopsis && item.synopsis.trim() ? (item.synopsis.length > 500 ? item.synopsis.substring(0, 497) + "..." : item.synopsis) : "N/A")
	//message.channel.send({embeds: [embed]});

	return embed;
}

// Handle JSON data and embed user message here
function createUserEmbed(message, type, item, includedData) {
	
	var userData = {
		name: item.attributes.name,
		avatar: item.attributes.avatar ? item.attributes.avatar.large : "https://kitsu.io/kitsu-256-ed442f7567271af715884ca3080e8240.png",
		waifu: '',
		waifuImage: '',
		animeFinished: '',
		animeGenre: '',
		animeGenreCount: 0,
		mangaFinished: '',
		mangaGenre: '',
		mangaGenreCount: 0,
		contentRated: item.attributes.ratingsCount.toString(),
		favoriteAnime: '',
		favoriteManga: '',
		favoriteChars: ''
	};

	// Parse through includedData
	for ( var i = 0; i < includedData.length; ++i ) {
		switch(includedData[i].type) {
			case 'characters':
				if ( item.relationships.waifu.data != null && !userData.waifu.length ) {
					userData.waifu = includedData[i].attributes.canonicalName;
					userData.waifuImage = includedData[i].attributes.image.original;
				}
				else {
					if ( userData.favoriteChars.length != 0 ) {
						userData.favoriteChars += ", ";
					}
					userData.favoriteChars += includedData[i].attributes.canonicalName;

					if ( item.relationships.waifu.data == null && !userData.waifuImage.length ) {
						userData.waifuImage = includedData[i].attributes.image.original;
					}
				}
				break;
			case 'anime':
				if ( userData.favoriteAnime.length != 0 ) {
					userData.favoriteAnime += ", ";
				}
				userData.favoriteAnime += includedData[i].attributes.canonicalTitle;
				break;
			case 'manga':
				if ( userData.favoriteManga.length != 0 ) {
					userData.favoriteManga += ", ";
				}
				userData.favoriteManga += includedData[i].attributes.canonicalTitle;
				break;
			case 'stats':
				switch(includedData[i].attributes.kind) {
					case 'anime-amount-consumed':
						userData.animeFinished = includedData[i].attributes.statsData.completed.toString();
						break;
					case 'anime-category-breakdown':
						for (const genre in includedData[i].attributes.statsData.categories) {
							if ( includedData[i].attributes.statsData.categories[genre] > userData.animeGenreCount ) {
								userData.animeGenreCount = includedData[i].attributes.statsData.categories[genre];
								userData.animeGenre = genre;
							}
						}
						break;
					case 'manga-amount-consumed':
						userData.mangaFinished = includedData[i].attributes.statsData.completed.toString();
						break;
					case 'manga-category-breakdown':
						for (const genre in includedData[i].attributes.statsData.categories) {
							if ( includedData[i].attributes.statsData.categories[genre] > userData.mangaGenreCount ) {
								userData.mangaGenreCount = includedData[i].attributes.statsData.categories[genre];
								userData.mangaGenre = genre;
							}
						}
						break;
					default:
						break;
				}
				break;
			default:
				break;
		}
	}

	// Send embed to channel
	const embed = new Discord.MessageEmbed()
	.setTitle(userData.name)
	.setThumbnail(userData.avatar)
	.setURL("https://kitsu.io/users/" + item.attributes.slug)
	.addField("Waifu", userData.waifu.length ? userData.waifu : "N/A", true)
	.addField("Anime Finished", userData.animeFinished.length ? userData.animeFinished : "0", true)
	.addField("Favorite Anime Genre", (userData.animeGenre.length ? userData.animeGenre : "N/A") + " (" + userData.animeGenreCount.toString() + ")", true)
	.addField("Voted", userData.contentRated, true)
	.addField("Manga Finished", userData.mangaFinished.length ? userData.mangaFinished : "0", true)
	.addField("Favorite Manga Genre", (userData.mangaGenre.length ? userData.mangaGenre : "N/A") + " (" + userData.mangaGenreCount.toString() + ")", true)
	.addField("Favorite Anime", userData.favoriteAnime.length ? userData.favoriteAnime : "N/A")
	.addField("Favorite Manga", userData.favoriteManga.length ? userData.favoriteManga : "N/A")
	.addField("Favorite Characters", userData.favoriteChars.length ? userData.favoriteChars : "N/A")

	if ( userData.waifuImage.length ) {
		embed.setImage(userData.waifuImage);
	}

	message.channel.send({embeds: [embed]});
}