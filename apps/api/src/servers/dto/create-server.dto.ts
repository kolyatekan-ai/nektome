import { IsString, Length } from 'class-validator';

export class CreateServerDto {
  @IsString()
  @Length(2, 64)
  name!: string;
}
