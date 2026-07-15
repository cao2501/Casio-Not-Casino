import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import { REST, Routes } from 'discord.js';
import path from 'path';
import fs from 'fs';

const token = process.env.BOT_TOKEN!;
const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID; // Optional: deploy to specific guild for testing

async function deployCommands() {
  if (!token || !clientId) {
    console.error('❌ BOT_TOKEN or CLIENT_ID missing in .env');
    process.exit(1);
  }

  const commands: any[] = [];
  const modulesDir = path.join(__dirname, 'modules');

  // Scan all modules for commands
  const moduleDirs = fs.readdirSync(modulesDir).filter(dir =>
    fs.statSync(path.join(modulesDir, dir)).isDirectory()
  );

  for (const moduleDir of moduleDirs) {
    const commandsDir = path.join(modulesDir, moduleDir, 'commands');
    if (!fs.existsSync(commandsDir)) continue;

    const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of commandFiles) {
      try {
        const cmdModule = require(path.join(commandsDir, file));
        const CmdClass = cmdModule.default;
        if (!CmdClass) continue;
        const cmd = new CmdClass();
        if (cmd.data) {
          commands.push(cmd.data.toJSON());
          console.log(`  ✅ [${moduleDir}] ${cmd.data.name}`);
        }
      } catch (err) {
        console.error(`  ❌ Failed to load command from ${file}:`, err);
      }
    }
  }

  console.log(`\n📤 Deploying ${commands.length} commands...`);

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    if (guildId) {
      // Guild-specific deploy (instant)
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`✅ Commands deployed to guild: ${guildId}`);
    } else {
      // Global deploy (takes up to 1 hour to propagate)
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('✅ Global commands deployed! (may take up to 1 hour to propagate)');
    }
  } catch (error) {
    console.error('❌ Deploy failed:', error);
    process.exit(1);
  }
}

deployCommands();
