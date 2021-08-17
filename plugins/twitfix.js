// Called by bot.js when message has twitter links
exports.run = (client, message) => {
    const fetch = require('node-fetch');
    const Discord = require('discord.js');
    const regex = /(https?:\/\/twitter[^\s]+)/g; // Regex to find all twitter links

    const linksArray = message.content.match(regex); // All pattern matches in an array of strings
    var searchUrl = "https://api.twitter.com/2/tweets?ids="; // Twitter API v2
    var fixedLinks = {}; // id to fxtwitter link lookup

    for ( var i = 0; i < linksArray.length; ++i ) {
        const twitterID = linksArray[i].replace(/\?.*$/,"").split('/').pop(); // Remove ?s= at the end, split with / and take the last element

        if ( twitterID && twitterID.length ) {
            fixedLinks[twitterID] = linksArray[i].replace("https://twitter.com/","https://fxtwitter.com/");
            //console.log("Twitter ID is (" + twitterID.toString() + ")" );
            if ( i > 0 ) {
                searchUrl += ",";     
		    }
            searchUrl += twitterID;
        }
	}
    //console.log(fixedLinks);
        
    searchUrl += "&expansions=attachments.media_keys,author_id&media.fields=url&user.fields";

	//console.log("Querying twitter api for tweet info (" + searchUrl + ")");
    fetch(searchUrl, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + process.env.TWITTER_BEARER,
        },
    })
    .then(response => response.json())
    .then(data => {
        var twitterIDs = []; // List of tweets to repost
        var imageEmbeds = {}; // Map of image URLs as key to Author info, if more than 1 (to help mobile discord users)
        for ( var j = 0; j < data.includes.media.length; ++j ) {
            if ( data.includes.media[j].type == "video" || data.includes.media[j].type == "animated_gif" ) {
                // Found a video/gif, find the tweet id by searching one that contain this video/gif's media key
                for ( var k = 0; k < data.data.length; ++k ) {
                    if (  data.data[k].attachments.media_keys.includes(data.includes.media[j].media_key) ) {
                        if ( !twitterIDs.includes(data.data[k].id) ) { // Avoid duplicates
                            twitterIDs.push(data.data[k].id);                     
						}
					}           
				}
			}
            else if ( data.includes.media[j].type == "photo" ) {
                // Found an image, find the tweet id and username by searching one that contain this image's media key
                const url = data.includes.media[j].url;
                for ( var k = 0; k < data.data.length; ++k ) {
                    if (  data.data[k].attachments.media_keys.includes(data.includes.media[j].media_key) ) {
                        // Search author's info
                        for ( var h = 0; h < data.includes.users.length; ++h ) {
                            if ( data.data[k].author_id === data.includes.users[h].id ) {
                                imageEmbeds[url] = [data.data[k].id, data.includes.users[h].name, data.includes.users[h].username];
							}
						}
                    }
                }
			}
		}

        // Add all tweets with links to the bot message
        if ( twitterIDs.length ) {
            var newMessage = "Found " + twitterIDs.length + " tweet" + ( twitterIDs.length > 1 ? "s" : "") + " with video content.\n";
            for ( var l = 0; l < twitterIDs.length; ++l ) {
                if ( twitterIDs[l] in fixedLinks ) {
                    newMessage += fixedLinks[twitterIDs[l]] + "\n";
                } else {
                    console.log("Error: cannot find twitter ID in the fixedLink object");     
			    }
		    }
		    message.channel.send({content: newMessage, allowedMentions: {repliedUser: false}, reply: { messageReference: message }});
            message.suppressEmbeds(true); // Remove original embeds
        }
        
        // Add all image embeds to an embed with pages to browse through them, if there is more than 1
        if ( Object.keys(imageEmbeds).length > 1 ) {
            const paginationEmbed = require('./pagination.js');
            var embedPages = [];
            for ( imageUrl in imageEmbeds ) {
                const embed = new Discord.MessageEmbed()
                                    .setTitle(imageEmbeds[imageUrl][1] + " (@" + imageEmbeds[imageUrl][2] + ")")
	                                .setURL("https://twitter.com/tweet/" + imageEmbeds[imageUrl][2] + "/" + imageEmbeds[imageUrl][0] )
                                    .setImage(imageUrl);
                embedPages.push(embed);
		    }
		    paginationEmbed(message, embedPages, false, 300000);
        }
    });
}