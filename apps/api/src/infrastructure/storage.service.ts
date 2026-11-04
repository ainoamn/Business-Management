import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { environment } from '../config/environment';

export interface StoragePort { available(): Promise<boolean> }

@Injectable()
export class StorageService implements StoragePort, OnModuleDestroy {
  private readonly client = new S3Client({
    endpoint:environment.S3_ENDPOINT,region:environment.S3_REGION,forcePathStyle:true,
    credentials:{accessKeyId:environment.S3_ACCESS_KEY,secretAccessKey:environment.S3_SECRET_KEY},
    maxAttempts:1,
  });
  async available() {
    await this.client.send(new HeadBucketCommand({Bucket:environment.S3_BUCKET}),{abortSignal:AbortSignal.timeout(2000)});
    return true;
  }
  onModuleDestroy() { this.client.destroy(); }
}
