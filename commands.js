import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0],
  dm_permission: false,
};

const ADD_ROFL_COMMAND = {
  name : 'add',
  description : 'Add a rofl file to the database',
  type : 1,
  integration_types : [0],
  dm_permission: false
};


const ALL_COMMANDS = [TEST_COMMAND,ADD_ROFL_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
