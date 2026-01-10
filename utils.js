import 'dotenv/config';
import { ROFLReader } from 'rofl-parser.js';
import { MongoClient } from 'mongodb';



export async function DiscordRequest(endpoint, options) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);
  // Use fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
    },
    ...options
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

export async function InstallGlobalCommands(appId, commands) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

// Simple method that returns a random emoji from list
export function getRandomEmoji() {
  const emojiList = ['😭','😄','😌','🤓','😎','😤','🤖','😶‍🌫️','🌏','📸','💿','👋','🌊','✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


export async function parse_rofl(url_file, filename, ennemyTeamName, gameType)
//Function for parsing rofl file into JSON 
{
  const file_content = await fetch(url_file);
  const arrayBuffer = await file_content.arrayBuffer();    
  const buffer = Buffer.from(arrayBuffer);    // <-- conversion ArrayBuffer -> Node Buffer
  const reader = new ROFLReader(buffer);
  const metadata = reader.getMetadata(); // données de la game

  function findPatchInBuffer(buf) {
    // lire d'abord une portion en début de fichier 
    const head = buf.toString('latin1', 0, Math.min(buf.length, 16384));

    const labeledRe = /(?:patch|version)[^\dVv]{0,8}([Vv]?\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)/i;
    const labeled = head.match(labeledRe);
    if (labeled && labeled[1]) return labeled[1].toUpperCase();

    // match général : accepte un leading V/v optionnel
    const verRe = /\b([Vv]?\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)\b/g;
    let m;
    while ((m = verRe.exec(head)) !== null) {
      let v = m[1];
      const normal = v.replace(/^[Vv]/, '');
      const major = parseInt(normal.split('.')[0], 10);
      if (!Number.isNaN(major) && major >= 4) return v.toUpperCase();
    }
  }


  function updateJsonKeys(metadata, filename, patch, ennemyTeamName, gameType) {
    // Ajouter le nom du fichier et le patch dans les métadonnées
    metadata.jsonFileName = filename;
    metadata.ennemyTeamName = ennemyTeamName;
    metadata.gameType = gameType;
    if (patch) metadata.patchVersion = patch;
    
    // metadata.officialMatch = isOfficialMatch(filename);

    // Changer le nom des clés
    if (metadata.hasOwnProperty('gameLength')) {
        metadata.gameDuration = metadata.gameLength;
        delete metadata.gameLength;
    }
    if (metadata.hasOwnProperty('statsJson')) {
        metadata.participants = metadata.statsJson;
        delete metadata.statsJson;
    }
    const positions = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
    metadata.participants.forEach((participant, index) => {
        participant.TRUE_POSITION = positions[index % 5];
    });

    return metadata;
  }

  const patch = findPatchInBuffer(buffer);
  const updatedMetadata = updateJsonKeys(metadata, filename, patch, ennemyTeamName, gameType);
  // console.log(updatedMetadata)
  return updatedMetadata
}

export async function write_mongo_collection(db_name,collection_name, data)
//Fonction to write data inside mongoDB
{
  let mongoClient;

  try {
      mongoClient = new MongoClient(process.env.DB_URI);
      await mongoClient.connect();

      const db = mongoClient.db(db_name);
      const collection = db.collection(collection_name);
      await collection.insertOne(data);
      await mongoClient.close();
      console.log("✅ Data inserted into MongoDB collection successfully.");
  } catch (error) {
      console.error('Connection to MongoDB Atlas failed!', error);
      process.exit();
  }


}

