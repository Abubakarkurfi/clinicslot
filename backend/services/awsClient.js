/**
 * AWS & Floci Emulator Client Integration
 * Connects to Floci / LocalStack AWS emulator (default http://localhost:4566)
 * Or standard AWS cloud endpoints based on environment variables.
 *
 * Implements services for all 3 student components:
 * - Abubakar (S1): Secrets Manager (auth secrets), SNS (booking events), Lambda, API Gateway
 * - Omar (S2): S3 (frontend hosting), Secrets Manager (config), Lambda, API Gateway
 * - Abdulahi (S3): CloudWatch Logs & Metrics, DynamoDB (daily queue), IAM, Lambda
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { CloudWatchLogsClient, CreateLogStreamCommand, PutLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { DynamoDBClient, PutItemCommand, QueryCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const isFloci = process.env.FLOCI_ENDPOINT || process.env.AWS_ENDPOINT_URL || process.env.LOCALSTACK_HOSTNAME;
const endpoint = process.env.FLOCI_ENDPOINT || process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const region = process.env.AWS_REGION || 'us-east-1';

// Base AWS Client Config
const clientConfig = {
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
  }
};

if (isFloci) {
  clientConfig.endpoint = endpoint;
}

// Instantiate AWS SDK v3 Clients
const secretsClient = new SecretsManagerClient(clientConfig);
const cwLogsClient = new CloudWatchLogsClient(clientConfig);
const dynamoClient = new DynamoDBClient(clientConfig);
const snsClient = new SNSClient(clientConfig);
const s3Client = new S3Client({ ...clientConfig, forcePathStyle: true });

// =============================================================================
// S1 (Abubakar): AWS Secrets Manager & Amazon SNS
// =============================================================================

/**
 * Fetch secret from AWS Secrets Manager (Student 1: Abubakar)
 */
async function getSecretFromSecretsManager(secretId) {
  try {
    const command = new GetSecretValueCommand({ SecretId: secretId });
    const response = await secretsClient.send(command);
    if (response.SecretString) {
      return JSON.parse(response.SecretString);
    }
    return null;
  } catch (err) {
    console.warn(`[AWS Secrets Manager] Notice: Could not read secret '${secretId}' from emulator (${err.message}). Using local config.`);
    return null;
  }
}

/**
 * Publish appointment event to Amazon SNS Topic (Student 1: Abubakar)
 */
async function publishBookingNotification(eventType, appointmentData) {
  try {
    const topicArn = process.env.BOOKING_TOPIC_ARN || 'arn:aws:sns:us-east-1:000000000000:clinicslot-booking-events';
    const message = JSON.stringify({
      event: eventType,
      appointmentId: appointmentData.id,
      patientId: appointmentData.patientId,
      doctorId: appointmentData.doctorId,
      startTime: appointmentData.startTime,
      timestamp: new Date().toISOString()
    });

    const command = new PublishCommand({
      TopicArn: topicArn,
      Subject: `ClinicSlot Event: ${eventType}`,
      Message: message
    });

    const response = await snsClient.send(command);
    console.log(`[AWS SNS] Published ${eventType} notification (MessageId: ${response.MessageId})`);
    return response;
  } catch (err) {
    console.warn(`[AWS SNS] Notification publish skipped (${err.message})`);
    return null;
  }
}

// =============================================================================
// S2 (Omar): Amazon S3 Frontend Hosting Integration
// =============================================================================

/**
 * Upload static assets to Amazon S3 Bucket (Student 2: Omar)
 */
async function uploadToS3(bucketName, key, body, contentType) {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType
    });
    const res = await s3Client.send(command);
    console.log(`[AWS S3] Uploaded ${key} to bucket ${bucketName}`);
    return res;
  } catch (err) {
    console.warn(`[AWS S3] Upload failed (${err.message})`);
    return null;
  }
}

// =============================================================================
// S3 (Abdulahi): Amazon CloudWatch Logs & Amazon DynamoDB Queue Cache
// =============================================================================

/**
 * Stream security audit events to Amazon CloudWatch Logs (Student 3: Abdulahi)
 */
async function sendToCloudWatchLogs(logGroupName, logStreamName, message) {
  try {
    const logEvent = {
      timestamp: Date.now(),
      message: typeof message === 'object' ? JSON.stringify(message) : String(message)
    };

    const command = new PutLogEventsCommand({
      logGroupName: logGroupName || '/aws/clinicslot/security-audit',
      logStreamName: logStreamName || 'app-stream',
      logEvents: [logEvent]
    });

    await cwLogsClient.send(command);
    console.log(`[AWS CloudWatch] Recorded security event to ${logGroupName}`);
  } catch (err) {
    // CloudWatch stream might need creation or Floci not active; keep silent to prevent disruption
  }
}

/**
 * Put appointment into DynamoDB Daily Queue (Student 3: Abdulahi)
 */
async function cacheInDynamoDBQueue(appointment) {
  try {
    const date = (appointment.startTime || '').split('T')[0];
    const command = new PutItemCommand({
      TableName: 'ClinicSlot_DailyQueue',
      Item: {
        date: { S: date },
        appointmentId: { S: appointment.id },
        patientName: { S: appointment.patientName || 'Patient' },
        doctorName: { S: appointment.doctorName || 'Doctor' },
        startTime: { S: appointment.startTime },
        status: { S: appointment.status || 'Booked' },
        updatedAt: { S: new Date().toISOString() }
      }
    });

    await dynamoClient.send(command);
    console.log(`[AWS DynamoDB] Cached appointment ${appointment.id} in ClinicSlot_DailyQueue`);
  } catch (err) {
    // Graceful pass-through if DynamoDB emulator table not yet provisioned
  }
}

module.exports = {
  isFloci,
  endpoint,
  getSecretFromSecretsManager,
  publishBookingNotification,
  uploadToS3,
  sendToCloudWatchLogs,
  cacheInDynamoDBQueue
};
