/**
 * AWS Lambda Handlers for Floci / AWS Serverless Deployment
 *
 * Implements dedicated Lambda compute functions for each student:
 * - s1BookingHandler: Student 1 (Abubakar Mansur kurfi) - S1 Patient Booking
 * - s2ScheduleHandler: Student 2 (Omar Osama) - S2 Doctor & Schedule
 * - s3ReceptionHandler: Student 3 (Abdulahi Jama) - S3 Reception Desk
 * - handler: Unified API Gateway Proxy Handler
 */

const serverless = require('serverless-http');
const app = require('./server');

// Unified API Gateway proxy handler
const handler = serverless(app);

// S1: Dedicated Patient Booking Lambda Function (Abubakar Mansur kurfi)
const s1BookingHandler = serverless(app);

// S2: Dedicated Doctor & Schedule Lambda Function (Omar Osama)
const s2ScheduleHandler = serverless(app);

// S3: Dedicated Reception Desk Lambda Function (Abdulahi Jama)
const s3ReceptionHandler = serverless(app);

module.exports = {
  handler,
  s1BookingHandler,
  s2ScheduleHandler,
  s3ReceptionHandler
};
