import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { GenerationConfigDto } from './generation-config.dto';

export class SummarizeTextDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10, { message: 'Văn bản cần tóm tắt phải có ít nhất 10 ký tự.' })
  @MaxLength(12000, {
    message: 'Văn bản cần tóm tắt không được vượt quá 12.000 ký tự.',
  })
  text!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GenerationConfigDto)
  config?: GenerationConfigDto;
}

export class SummaryOutputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  summary!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  keyPoints!: string[];
}

export class RunToolsPromptDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Prompt cannot be empty.' })
  @MaxLength(4000, { message: 'Prompt must not exceed 4000 characters.' })
  prompt!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GenerationConfigDto)
  config?: GenerationConfigDto;
}
