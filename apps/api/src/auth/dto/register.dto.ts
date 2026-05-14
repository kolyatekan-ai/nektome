import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9_.]+$/, {
    message: 'username may contain only letters, digits, dot and underscore',
  })
  username!: string;

  @IsString()
  @Length(1, 64)
  displayName!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}
