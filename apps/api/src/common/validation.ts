import {BadRequestException} from '@nestjs/common';
export function validate<T>(schema:{safeParse(input:unknown):{success:true;data:T}|{success:false}},input:unknown):T {const parsed=schema.safeParse(input);if(!parsed.success)throw new BadRequestException('Invalid input');return parsed.data;}
