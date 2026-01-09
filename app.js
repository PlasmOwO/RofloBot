import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest, parse_rofl, write_mongo_collection } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';

// Create an express app
const app = express();

const PORT = process.env.PORT || 8100;

// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    //
    if (name == 'add'){
      return res.send({
        type : InteractionResponseType.MODAL,
        data : {
          custom_id : 'add_rofl',
          title : "Add a Rofl file",
          components : [
            {
              type : 18,
              label : "Name / Date of the game",
              component : {
                type : 4,
                custom_id : "game_date",
                placeholder : "Format ddmmyyyy_gamenumberX - Exemple 26102025_2",
                style : 1, //une seule ligne,
                min_lenght : 10,
                max_lenght : 11,
                required : true,
              }
            },
            {
              type : 18,
              label : "Name of the enemy team",
              component : {
                type : 4,
                custom_id : "team_name",
                placeholder : "Les gourmands",
                style : 1, //une seule ligne,
                min_lenght : 2,
                max_lenght : 50,
                required : true,
              }
            },
            {
              type : 18,
              label : "Rofl file",
              component : {
                type : 19,
                custom_id : "rofl_file_uploaded",
                placeholder : "Les gourmands",
                required : true,
              }
            }

          ]
          }
        });
      }
    

    // // "challenge" command
    // if (name === 'challenge' && id) {
    //   // Interaction context
    //   const context = req.body.context;
    //   // User ID is in user field for (G)DMs, and member for servers
    //   const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
    //   // User's object choice
    //   const objectName = req.body.data.options[0].value;

    //   // Create active game using message ID as the game ID
    //   activeGames[id] = {
    //     id: userId,
    //     objectName,
    //   };

    //   return res.send({
    //     type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    //     data: {
    //       flags: InteractionResponseFlags.IS_COMPONENTS_V2,
    //       components: [
    //         {
    //           type: MessageComponentTypes.TEXT_DISPLAY,
    //           // Fetches a random emoji to send from a helper function
    //           content: `Rock papers scissors challenge from <@${userId}>`,
    //         },
    //         {
    //           type: MessageComponentTypes.ACTION_ROW,
    //           components: [
    //             {
    //               type: MessageComponentTypes.BUTTON,
    //               // Append the game ID to use later on
    //               custom_id: `accept_button_${req.body.id}`,
    //               label: 'Accept',
    //               style: ButtonStyleTypes.PRIMARY,
    //             },
    //           ],
    //         },
    //       ],
    //     },
    //   });
    // }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  /**
   * Handle requests from interactive components
   * See https://discord.com/developers/docs/components/using-message-components#using-message-components-with-interactions
   */
  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
    const componentId = data.custom_id;

    if (componentId.startsWith('accept_button_')) {
      // get the associated game ID
      const gameId = componentId.replace('accept_button_', '');
      // Delete message with token in request body
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
      try {
        await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Indicates it'll be an ephemeral message
            flags: InteractionResponseFlags.EPHEMERAL | InteractionResponseFlags.IS_COMPONENTS_V2,
            components: [
              {
                type: MessageComponentTypes.TEXT_DISPLAY,
                content: 'What is your object of choice?',
              },
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.STRING_SELECT,
                    // Append game ID
                    custom_id: `select_choice_${gameId}`,
                    options: getShuffledOptions(),
                  },
                ],
              },
            ],
          },
        });
        // Delete previous message
        await DiscordRequest(endpoint, { method: 'DELETE' });
      } catch (err) {
        console.error('Error sending message:', err);
      }
    } else if (componentId.startsWith('select_choice_')) {
      // get the associated game ID
      const gameId = componentId.replace('select_choice_', '');

      if (activeGames[gameId]) {
        // Interaction context
        const context = req.body.context;
        // Get user ID and object choice for responding user
        // User ID is in user field for (G)DMs, and member for servers
        const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
        const objectName = data.values[0];
        // Calculate result from helper function
        const resultStr = getResult(activeGames[gameId], {
          id: userId,
          objectName,
        });

        // Remove game from storage
        delete activeGames[gameId];
        // Update message with token in request body
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;

        try {
          // Send results
          await res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { 
              flags: InteractionResponseFlags.IS_COMPONENTS_V2,
              components: [
                {
                  type: MessageComponentTypes.TEXT_DISPLAY,
                  content: resultStr
                }
              ]
             },
          });
          // Update ephemeral message
          await DiscordRequest(endpoint, {
            method: 'PATCH',
            body: {
              components: [
                {
                  type: MessageComponentTypes.TEXT_DISPLAY,
                  content: 'Nice choice ' + getRandomEmoji()
                }
              ],
            },
          });
        } catch (err) {
          console.error('Error sending message:', err);
        }
      }
    }
    
    return;
  }


  if (type === InteractionType.MODAL_SUBMIT)
  {
    const customId = data.custom_id;
    const metadata = {game_date : data.components[0].component.value, enemy_team : data.components[1].component.value};
    const rofl_file = Object.values(data.resolved.attachments)[0].url
    const game_metadata_json = await parse_rofl(rofl_file,metadata.game_date, metadata.enemy_team);

    await write_mongo_collection("lol_match_database","scrim_matches",game_metadata_json);
    // récupérer le fichier, le lire, le parser dans la fonction de parsing que j'ai créé et l'envoie sur la BDD
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `✅ Rofl received : ${JSON.stringify({"Metadata" : metadata, "File" : rofl_file})}`,
      },
    });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
