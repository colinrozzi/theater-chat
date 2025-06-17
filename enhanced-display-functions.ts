// Enhanced display functions - replace the existing ones in your src/index.ts

function getModelDisplayName(model: string): string {
  // Clean up model names for better display
  const modelMap: Record<string, string> = {
    'claude-sonnet-4-20250514': 'Claude Sonnet 4',
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'claude-3-opus-20240229': 'Claude 3 Opus',
    'gpt-4': 'GPT-4',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'gemini-1.5-pro': 'Gemini 1.5 Pro',
    'gemini-1.5-flash': 'Gemini 1.5 Flash',
    'gemini-2.5-pro-preview-06-05': 'Gemini 2.5 Pro (Preview)',
  };
  
  return modelMap[model] || model;
}

function formatConfigName(name: string, format: 'legacy' | 'theater' | 'invalid'): string {
  const maxLength = 20;
  const truncated = name.length > maxLength ? name.substring(0, maxLength - 1) + '…' : name;
  
  let statusColor = chalk.green;
  if (format === 'invalid') statusColor = chalk.red;
  else if (format === 'legacy') statusColor = chalk.yellow;
  
  return statusColor.bold(truncated);
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines;
}

function displayConfigInfo(config: ConfigInfo, indent: string): void {
  const formatIcon = getFormatIcon(config.format);
  const modelDisplay = getModelDisplayName(config.model);
  const toolsIndicator = config.hasTools ? chalk.green(`●`) : chalk.gray(`○`);
  
  // Main config line - cleaner format
  const configLine = `${formatConfigName(config.name, config.format)} ${formatIcon}`;
  const modelLine = chalk.cyan(modelDisplay);
  const toolsLine = `${toolsIndicator} ${config.toolCount} ${config.toolCount === 1 ? 'tool' : 'tools'}`;
  
  console.log(`${indent}${configLine}`);
  console.log(`${indent}${chalk.gray('├─')} ${config.title}`);
  
  // Show description if available
  if (config.description) {
    const wrappedDescription = wrapText(config.description, 60);
    wrappedDescription.forEach((line, index) => {
      const prefix = index === 0 ? '├─' : '│ ';
      console.log(`${indent}${chalk.gray(prefix)} ${chalk.italic.gray(line)}`);
    });
  }
  
  console.log(`${indent}${chalk.gray('├─')} ${modelLine} ${chalk.gray('•')} ${toolsLine}`);
  
  // Format warnings - more subtle
  if (config.format === 'legacy') {
    console.log(`${indent}${chalk.gray('└─')} ${chalk.yellow('⚠ Legacy format')}`);
  } else if (config.format === 'invalid') {
    console.log(`${indent}${chalk.gray('└─')} ${chalk.red('✗ Invalid configuration')}`);
  } else {
    console.log(`${indent}${chalk.gray('└─')} ${chalk.green('✓ Theater format')}`);
  }
}

function displayProviderSection(provider: string, configs: ConfigInfo[], indent: string): void {
  const icon = getProviderIcon(provider);
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
  const count = configs.length;
  
  console.log(`${indent}${icon} ${chalk.magenta.bold(providerName)} ${chalk.gray(`(${count})`)}`);
  console.log('');
  
  configs.forEach((config, index) => {
    displayConfigInfo(config, indent + '  ');
    
    // Add spacing between configs, but not after the last one
    if (index < configs.length - 1) {
      console.log('');
    }
  });
}

// Replace your existing listConfigs function with this enhanced version
function listConfigs(options: ConfigListOptions): void {
  const showGlobal = options.global || options.all;
  const showLocal = !options.global;

  console.log(chalk.blue.bold('🎭 Theater Chat Configurations'));
  console.log('');

  if (showLocal) {
    console.log(chalk.cyan.bold('📁 Local'));
    const localConfigDir = '.theater-chat';
    console.log(chalk.gray(`   ${path.resolve(localConfigDir)}`));
    console.log('');

    const localConfigs = collectConfigsInDirectory(localConfigDir);
    
    if (localConfigs.length === 0) {
      console.log(chalk.gray('   No configurations found'));
      console.log(chalk.gray('   Run ') + chalk.cyan('theater-chat init') + chalk.gray(' to create local configs'));
    } else {
      const configsByProvider = groupConfigsByProvider(localConfigs);
      const providers = Object.entries(configsByProvider).filter(([_, configs]) => configs.length > 0);
      
      providers.forEach(([provider, configs], index) => {
        displayProviderSection(provider, configs, '   ');
        
        // Add spacing between provider sections, but not after the last one
        if (index < providers.length - 1) {
          console.log('');
        }
      });
    }
    console.log('');
  }

  if (showGlobal) {
    console.log(chalk.cyan.bold('🌐 Global'));
    const configDir = getConfigDir();
    console.log(chalk.gray(`   ${configDir}`));
    console.log('');

    const globalConfigs = collectConfigsInDirectory(configDir);
    
    if (globalConfigs.length === 0) {
      console.log(chalk.gray('   No configurations found'));
      console.log(chalk.gray('   Run ') + chalk.cyan('theater-chat init --global') + chalk.gray(' to create global configs'));
    } else {
      const configsByProvider = groupConfigsByProvider(globalConfigs);
      const providers = Object.entries(configsByProvider).filter(([_, configs]) => configs.length > 0);
      
      providers.forEach(([provider, configs], index) => {
        displayProviderSection(provider, configs, '   ');
        
        // Add spacing between provider sections, but not after the last one
        if (index < providers.length - 1) {
          console.log('');
        }
      });
    }
    console.log('');
  }

  // Cleaner usage section
  const allLocalConfigs = showLocal ? collectConfigsInDirectory('.theater-chat') : [];
  const allGlobalConfigs = showGlobal ? collectConfigsInDirectory(getConfigDir()) : [];
  const allConfigs = [...allLocalConfigs, ...allGlobalConfigs];
  const validConfigs = allConfigs.filter(c => c.format !== 'invalid');
  
  if (validConfigs.length > 0) {
    console.log(chalk.blue.bold('📖 Usage'));
    console.log('');
    
    console.log(chalk.gray('   Basic commands:'));
    console.log(`   ${chalk.cyan('theater-chat')}                    # Default config`);
    
    // Show examples with the actual configs found
    const examples = validConfigs.slice(0, 2);
    examples.forEach(config => {
      const command = `theater-chat --config ${config.name}`;
      const paddedCommand = command.padEnd(35);
      console.log(`   ${chalk.cyan(paddedCommand)} # ${config.title}`);
    });
    
    console.log('');
    console.log(chalk.gray('   Management:'));
    console.log(`   ${chalk.cyan('theater-chat list --all')}         # Show all configurations`);
    console.log(`   ${chalk.cyan('theater-chat init')}               # Initialize local configs`);
    
    // Migration tip if needed
    const hasLegacy = validConfigs.some(c => c.format === 'legacy');
    if (hasLegacy) {
      console.log('');
      console.log(chalk.yellow('   💡 Some configs use legacy format. Consider updating to theater format.'));
    }
    
    console.log('');
  }
}
