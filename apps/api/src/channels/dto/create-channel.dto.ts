import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @Length(1, 64)
  name!: string;

  @IsOptional()
  @IsEnum(['TEXT', 'VOICE', 'CATEGORY'] as const)
  type?: 'TEXT' | 'VOICE' | 'CATEGORY';

  @IsOptional()
  @IsString()
  topic?: string;
}
