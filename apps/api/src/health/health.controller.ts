import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Infrastructure')
@Controller('health')
export class HealthController {
  constructor(private readonly health:HealthService) {}
  @Get('live')
  @ApiOperation({summary:'Process liveness; does not imply dependency readiness'})
  live() { return {status:'alive'}; }

  @Get('ready')
  @ApiOperation({summary:'Checks schema, Redis, actual BullMQ worker round trip and private storage bucket'})
  @ApiResponse({status:200,description:'All dependencies ready'})
  @ApiResponse({status:503,description:'One or more dependencies unavailable'})
  async ready() {
    const result = await this.health.check();
    if (result.status !== 'ready') throw new ServiceUnavailableException(result);
    return result;
  }
}
