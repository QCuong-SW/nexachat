import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class GenerationConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(64)
  @Max(8192)
  maxOutputTokens?: number;
}

export class SendMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Message content cannot be empty.' })
  @MaxLength(32000, { message: 'Message content is too long.' })
  content!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GenerationConfigDto)
  config?: GenerationConfigDto;
}
