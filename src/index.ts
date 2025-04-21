import { TwitterApi, ApiResponseError } from 'twitter-api-v2';
import * as dotenv from 'dotenv';
import type { TweetV2 } from 'twitter-api-v2';

dotenv.config();

const USERNAME = process.env.X_USERNAME || '';
let USER_ID: string | null = null;

if (!USERNAME) {
  console.error('Error: X_USERNAME is not set in environment variables');
  process.exit(1);
}

// Initialize API client
const client = new TwitterApi({
  appKey: process.env.X_API_KEY!,
  appSecret: process.env.X_API_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

const DELETE_INTERVAL = 5000;
const MIN_API_LIMIT_WAIT = 900000; // 15 minutes
const MAX_API_LIMIT_WAIT = 3600000; // 1 hour
const MAX_RETRIES = 3;

function calculateWaitTime(resetTime: string | number | undefined | null): number {
  if (!resetTime) return MIN_API_LIMIT_WAIT;
  
  const resetTimestamp = typeof resetTime === 'string' 
    ? new Date(resetTime).getTime() / 1000 
    : typeof resetTime === 'number' ? resetTime : Date.now() / 1000;
    
  const now = Math.floor(Date.now() / 1000);
  const waitSeconds = resetTimestamp - now;
  
  if (waitSeconds <= 0) return MIN_API_LIMIT_WAIT;
  return Math.min(waitSeconds * 1000 + 60000, MAX_API_LIMIT_WAIT);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatRateLimit(response: any) {
  if (!response || !response.rateLimit) return 'No rate limit information available';
  
  const { limit, remaining, reset } = response.rateLimit;
  const resetDate = reset ? new Date(reset * 1000) : null;
  
  return `
Rate Limit Information:
- Total Limit: ${limit || 'Unknown'}
- Remaining: ${remaining || 'Unknown'}
- Reset Time: ${resetDate ? resetDate.toLocaleString() : 'Unknown'}
`;
}

async function checkApiStatus() {
  try {
    console.log('\nChecking API status...');
    
    // Check user information rate limit
    const userResponse = await client.v2.userByUsername(USERNAME);
    console.log('\n[User Information API Rate Limit]');
    console.log(formatRateLimit(userResponse));
    
    if (userResponse.data) {
      // Check timeline rate limit
      const timelineResponse = await client.v2.userTimeline(userResponse.data.id, { max_results: 5 });
      console.log('\n[Timeline API Rate Limit]');
      console.log(formatRateLimit(timelineResponse));
    }
    
    return true;
  } catch (error: any) {
    console.error('\nError occurred while checking API status:', error.message || error);
    if (error.code === 429) {
      console.log(formatRateLimit(error));
    }
    return false;
  }
}

function isRateLimitError(error: any): error is ApiResponseError {
  return error instanceof ApiResponseError && error.rateLimitError;
}

async function getUserId(): Promise<string> {
  if (USER_ID) return USER_ID;

  try {
    const response = await client.v2.me();
    return response.data.id;
  } catch (error: any) {
    if (isRateLimitError(error)) {
      const resetTime = error.rateLimit?.reset;
      console.log('Rate limit reached. Rate limit information:', formatRateLimit(error));
      const waitTime = calculateWaitTime(resetTime);
      console.log(`Waiting for ${Math.floor(waitTime / 1000 / 60)} minutes...`);
      await sleep(waitTime);
      return getUserId();
    }
    throw error;
  }
}

async function getAllTweetsAtOnce(): Promise<TweetV2[]> {
  try {
    const userId = await getUserId();
    const response = await client.v2.userTimeline(userId, {
      max_results: 100,
      'tweet.fields': ['created_at'],
    });
    return response.tweets || [];
  } catch (error: any) {
    if (isRateLimitError(error)) {
      const resetTime = error.rateLimit?.reset;
      console.log('Rate limit reached. Rate limit information:', formatRateLimit(error));
      const waitTime = calculateWaitTime(resetTime);
      console.log(`Waiting for ${Math.floor(waitTime / 1000 / 60)} minutes...`);
      await sleep(waitTime);
      return getAllTweetsAtOnce();
    }
    throw error;
  }
}

async function deleteTweets() {
  try {
    // First, check API status
    console.log('Checking API status...');
    const apiStatus = await checkApiStatus();
    if (!apiStatus) {
      console.log('Cannot proceed due to API rate limit. Please try again later.');
      return;
    }

    console.log('\nRetrieving tweets...');
    const tweets = await getAllTweetsAtOnce();

    if (tweets.length <= 1) {
      console.log('No tweets found for deletion.');
      return;
    }

    console.log(`Found ${tweets.length} tweets. Will delete all except the most recent one.`);

    const tweetsToDelete = tweets.slice(1);
    let deletedCount = 0;
    let failedCount = 0;

    console.log('Starting deletion process...');

    for (const tweet of tweetsToDelete) {
      try {
        const deleteResponse = await client.v2.deleteTweet(tweet.id);
        deletedCount++;
        const progress = Math.round(deletedCount/tweetsToDelete.length*100);
        console.log(`Deletion complete: ${deletedCount}/${tweetsToDelete.length} (${progress}%)`);
        console.log('Delete API rate limit:', formatRateLimit(deleteResponse));
        
        await sleep(DELETE_INTERVAL);
      } catch (error: any) {
        failedCount++;
        console.error(`Failed to delete tweet ${tweet.id}:`, error.message || error);
        
        if (error.code === 429) {
          console.log('Rate limit reached. Rate limit information:', formatRateLimit(error));
          console.log('Waiting for 15 minutes...');
          await sleep(calculateWaitTime(tweet.created_at));
        } else {
          await sleep(DELETE_INTERVAL * 2);
        }
      }
    }

    console.log('\nDeletion process completed');
    console.log(`Successful: ${deletedCount} tweets`);
    console.log(`Failed: ${failedCount} tweets`);
    
    if (failedCount > 0) {
      console.log('Some tweets failed to delete. Please try again later.');
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}

// Script execution
console.log('Starting deletion process. Press Ctrl+C to interrupt.');
console.log('The most recent tweet will be preserved.');
console.log('The process may take time due to API rate limits.');
deleteTweets().catch(console.error); 