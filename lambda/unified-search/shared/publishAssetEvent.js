const https = require('https');

const SNS_TOPIC_ARN = 'arn:aws:sns:us-west-2:131745734428:cwf-asset-events';

async function publishAssetEvent(eventType, assetType, assetId, assetData) {
  const message = JSON.stringify({
    eventType,
    assetType,
    assetId,
    assetData,
    timestamp: new Date().toISOString()
  });
  
  const params = new URLSearchParams({
    Action: 'Publish',
    TopicArn: SNS_TOPIC_ARN,
    Message: message,
    Version: '2010-03-31'
  });
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `sns.us-west-2.amazonaws.com`,
      path: `/?${params.toString()}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = { publishAssetEvent };
