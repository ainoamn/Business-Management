import {Injectable,Logger} from '@nestjs/common';

export interface CalendarEvent {
  id:string;
  title:string;
  start:Date;
  end:Date;
  attendees?:string[];
}

export interface CalendarProvider {
  listEvents(start:Date,end:Date):Promise<CalendarEvent[]>;
  createEvent(event:Omit<CalendarEvent,'id'>):Promise<CalendarEvent>;
  updateEvent(id:string,event:Partial<CalendarEvent>):Promise<CalendarEvent>;
  deleteEvent(id:string):Promise<void>;
}

export interface DriveFile {
  id:string;
  name:string;
  mimeType:string;
  size:number;
  modifiedAt:Date;
}

export interface DriveProvider {
  listFiles(folderId?:string):Promise<DriveFile[]>;
  uploadFile(name:string,content:Buffer,mimeType:string,folderId?:string):Promise<DriveFile>;
  downloadFile(id:string):Promise<Buffer>;
  deleteFile(id:string):Promise<void>;
}

export interface TeamsChannel {
  id:string;
  name:string;
}

export interface TeamsMessage {
  id:string;
  content:string;
  from:string;
  createdAt:Date;
}

export interface TeamsProvider {
  listChannels():Promise<TeamsChannel[]>;
  sendMessage(channelId:string,content:string):Promise<TeamsMessage>;
  listMessages(channelId:string,limit?:number):Promise<TeamsMessage[]>;
}

export interface SsoUser {
  id:string;
  email:string;
  displayName:string;
  groups?:string[];
}

export interface SsoProvider {
  getAuthUrl(state:string):string;
  exchangeCode(code:string):Promise<{accessToken:string;refreshToken?:string}>;
  getUser(accessToken:string):Promise<SsoUser>;
  refreshToken(refreshToken:string):Promise<{accessToken:string;refreshToken?:string}>;
}

@Injectable()
export class UnconfiguredCalendarProvider implements CalendarProvider {
  private readonly logger=new Logger(UnconfiguredCalendarProvider.name);

  async listEvents():Promise<CalendarEvent[]>{
    this.logger.warn('Calendar provider not configured');
    throw new Error('CALENDAR_NOT_CONFIGURED');
  }

  async createEvent():Promise<CalendarEvent>{
    throw new Error('CALENDAR_NOT_CONFIGURED');
  }

  async updateEvent():Promise<CalendarEvent>{
    throw new Error('CALENDAR_NOT_CONFIGURED');
  }

  async deleteEvent():Promise<void>{
    throw new Error('CALENDAR_NOT_CONFIGURED');
  }
}

@Injectable()
export class UnconfiguredDriveProvider implements DriveProvider {
  private readonly logger=new Logger(UnconfiguredDriveProvider.name);

  async listFiles():Promise<DriveFile[]>{
    this.logger.warn('Drive provider not configured');
    throw new Error('DRIVE_NOT_CONFIGURED');
  }

  async uploadFile():Promise<DriveFile>{
    throw new Error('DRIVE_NOT_CONFIGURED');
  }

  async downloadFile():Promise<Buffer>{
    throw new Error('DRIVE_NOT_CONFIGURED');
  }

  async deleteFile():Promise<void>{
    throw new Error('DRIVE_NOT_CONFIGURED');
  }
}

@Injectable()
export class UnconfiguredTeamsProvider implements TeamsProvider {
  private readonly logger=new Logger(UnconfiguredTeamsProvider.name);

  async listChannels():Promise<TeamsChannel[]>{
    this.logger.warn('Teams provider not configured');
    throw new Error('TEAMS_NOT_CONFIGURED');
  }

  async sendMessage():Promise<TeamsMessage>{
    throw new Error('TEAMS_NOT_CONFIGURED');
  }

  async listMessages():Promise<TeamsMessage[]>{
    throw new Error('TEAMS_NOT_CONFIGURED');
  }
}

@Injectable()
export class UnconfiguredSsoProvider implements SsoProvider {
  private readonly logger=new Logger(UnconfiguredSsoProvider.name);

  getAuthUrl():string{
    this.logger.warn('SSO provider not configured');
    throw new Error('SSO_NOT_CONFIGURED');
  }

  async exchangeCode():Promise<{accessToken:string;refreshToken?:string}>{
    throw new Error('SSO_NOT_CONFIGURED');
  }

  async getUser():Promise<SsoUser>{
    throw new Error('SSO_NOT_CONFIGURED');
  }

  async refreshToken():Promise<{accessToken:string;refreshToken?:string}>{
    throw new Error('SSO_NOT_CONFIGURED');
  }
}
