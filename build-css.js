#!/usr/bin/env node

/**
 * CSS Build Script for QuizMaster Pro
 * Processes CSS with autoprefixer and minification for better browser compatibility
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🎨 Building CSS for QuizMaster Pro...');

// Ensure PostCSS is available
try {
  require('postcss');
  require('autoprefixer');
  require('cssnano');
} catch (error) {
  console.error('❌ Missing dependencies. Please run: npm install');
  process.exit(1);
}

const inputFile = 'public/css/main.css';
const outputFile = 'public/css/main.min.css';

// Check if input file exists
if (!fs.existsSync(inputFile)) {
  console.error(`❌ Input file not found: ${inputFile}`);
  process.exit(1);
}

try {
  // Run PostCSS with autoprefixer
  console.log('📦 Processing CSS with autoprefixer...');
  
  const command = `npx postcss ${inputFile} -o ${outputFile} --verbose`;
  execSync(command, { stdio: 'inherit' });
  
  // Get file sizes for comparison
  const originalSize = fs.statSync(inputFile).size;
  const processedSize = fs.statSync(outputFile).size;
  const savings = ((originalSize - processedSize) / originalSize * 100).toFixed(1);
  
  console.log('✅ CSS build complete!');
  console.log(`📊 Original: ${(originalSize / 1024).toFixed(1)}KB`);
  console.log(`📊 Processed: ${(processedSize / 1024).toFixed(1)}KB`);
  console.log(`📊 Savings: ${savings}%`);
  
  // Create a development version without minification
  const devOutputFile = 'public/css/main.prefixed.css';
  const devCommand = `npx postcss ${inputFile} -o ${devOutputFile} --config postcss.dev.config.js --verbose`;
  
  // Create dev config
  const devConfig = `module.exports = {
  plugins: [
    require('autoprefixer')({
      overrideBrowserslist: [
        'last 2 Chrome versions',
        'last 2 Firefox versions', 
        'last 2 Safari versions',
        'last 2 Edge versions',
        'ie >= 11',
        '> 1%',
        'not dead'
      ],
      grid: 'autoplace',
      remove: true
    })
  ]
};`;
  
  fs.writeFileSync('postcss.dev.config.js', devConfig);
  
  try {
    execSync(devCommand, { stdio: 'inherit' });
    const devSize = fs.statSync(devOutputFile).size;
    console.log(`📊 Dev version: ${(devSize / 1024).toFixed(1)}KB (with prefixes, no minification)`);
    
    // Clean up temp config
    fs.unlinkSync('postcss.dev.config.js');
  } catch (devError) {
    console.warn('⚠️  Could not create development version');
  }
  
  console.log('');
  console.log('🎉 CSS processing complete! Files created:');
  console.log(`   • ${outputFile} (production - minified with prefixes)`);
  console.log(`   • ${devOutputFile} (development - prefixes only)`);
  console.log('');
  console.log('💡 To use in production, update your HTML to reference main.min.css');
  
} catch (error) {
  console.error('❌ CSS build failed:', error.message);
  process.exit(1);
}