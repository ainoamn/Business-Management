import { describe, expect, it } from 'vitest';
import { environmentSchema, paginationSchema, parseEnvironment, organizationIdSchema } from '../../packages/shared-schemas/src';

const valid={WEB_ORIGIN:'http://localhost:3000',DATABASE_URL:'postgresql://app:password@localhost:5432/work',REDIS_URL:'redis://localhost:6379',S3_ENDPOINT:'http://localhost:9000',S3_REGION:'us-east-1',S3_BUCKET:'work-private',S3_ACCESS_KEY:'test-access',S3_SECRET_KEY:'local-test-secret-at-least-16'};
describe('environment validation',()=>{
  it('accepts development values and applies defaults',()=>{expect(parseEnvironment(valid)).toMatchObject({PORT:4000,DEPLOYMENT_ENV:'development'});});
  it.each(['DATABASE_URL','REDIS_URL','S3_SECRET_KEY','WEB_ORIGIN'])('rejects missing %s',key=>{
    expect(environmentSchema.safeParse({...valid,[key]:undefined}).success).toBe(false);
  });
  it('rejects wrong database and cache protocols',()=>{
    expect(environmentSchema.safeParse({...valid,DATABASE_URL:'https://example.com'}).success).toBe(false);
    expect(environmentSchema.safeParse({...valid,REDIS_URL:'https://example.com'}).success).toBe(false);
  });
  it('requires HTTPS in staging and production',()=>{
    expect(environmentSchema.safeParse({...valid,NODE_ENV:'production',DEPLOYMENT_ENV:'production'}).success).toBe(false);
    expect(environmentSchema.safeParse({...valid,NODE_ENV:'production',DEPLOYMENT_ENV:'staging',WEB_ORIGIN:'https://work.example.com',S3_ENDPOINT:'https://s3.example.com'}).success).toBe(true);
  });
  it('does not leak secret values in diagnostics',()=>{
    expect(()=>parseEnvironment({...valid,S3_SECRET_KEY:'sensitive'})).toThrow('S3_SECRET_KEY');
    try{parseEnvironment({...valid,S3_SECRET_KEY:'sensitive'});}catch(error){expect(String(error)).not.toContain('sensitive');}
  });
});
describe('shared input boundaries',()=>{
  it('bounds pagination and rejects unrecognized fields',()=>{
    expect(paginationSchema.parse({})).toEqual({page:1,pageSize:25});
    expect(paginationSchema.safeParse({pageSize:101}).success).toBe(false);
    expect(paginationSchema.safeParse({page:-1}).success).toBe(false);
    expect(paginationSchema.safeParse({role:'OWNER'}).success).toBe(false);
  });
  it('validates organization identifiers',()=>{expect(organizationIdSchema.safeParse("1; DROP TABLE users").success).toBe(false);});
});
