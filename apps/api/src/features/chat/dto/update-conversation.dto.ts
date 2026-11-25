import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateConversationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Title cannot be empty.' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters.' })
  title!: string;
}
