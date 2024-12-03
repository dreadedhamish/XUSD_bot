const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const sharp = require('sharp');

async function generateVibePassImage(wallet, passId) {
  // Load SVG XML
  const svgFilePath = path.join(__dirname, 'VibePass.svg');
  const svgXml = fs.readFileSync(svgFilePath, 'utf8');

  // Parse SVG XML
  const result = await xml2js.parseStringPromise(svgXml);

  // Ensure the text elements are accessed safely
  const textElements = [];
  function findTextElements(node) {
    if (node.text) {
      textElements.push(...node.text);
    }
    if (node.g) {
      node.g.forEach(findTextElements);
    }
  }
  findTextElements(result.svg);

  // Replace text fields
  textElements.forEach((textElement, index) => {
    if (index === 0) {
      textElement._ = wallet;
    } else if (index === 1) {
      textElement._ = `#${passId}`; 
    }
  });

  // Convert modified SVG back to XML
  const builder = new xml2js.Builder();
  const modifiedSvgXml = builder.buildObject(result);

  // Ensure the /image_cache subdirectory exists
  const imageCacheDir = path.join(__dirname, 'image_cache');
  if (!fs.existsSync(imageCacheDir)) {
    fs.mkdirSync(imageCacheDir);
  }

  // Convert SVG to PNG
  const outputFilePath = path.join(imageCacheDir, 'VibePassOutput.png');
  await sharp(Buffer.from(modifiedSvgXml))
    .png()
    .toFile(outputFilePath);

  console.log('PNG image generated:', outputFilePath);
  return outputFilePath;
}

module.exports = { generateVibePassImage };