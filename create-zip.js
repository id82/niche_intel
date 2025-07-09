const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Get version from manifest
const manifestPath = path.join(__dirname, 'dist', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version;

// Create zip filename
const zipName = `nicheintel-pro-v${version}.zip`;
const zipPath = path.join(__dirname, zipName);

// Create a file to stream archive data to
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
});

// Listen for all archive data to be written
output.on('close', function() {
    console.log(`✅ NicheIntel Pro package created: ${zipName}`);
    console.log(`📦 Total size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🚀 Ready for Chrome Web Store upload!`);
});

// Handle errors
archive.on('error', function(err) {
    throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add the entire dist directory
archive.directory('dist/', false);

// Finalize the archive
archive.finalize();