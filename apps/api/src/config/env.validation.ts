import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  @IsOptional()
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  API_PORT: number = 4000;

  @IsString()
  @MinLength(1)
  CORS_ORIGIN: string = 'http://localhost:3000';

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET must be at least 32 characters long',
  })
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  COOKIE_NAME: string = 'nexa_session';

  @IsString()
  @IsOptional()
  GEMINI_API_KEY?: string;

  @IsString()
  @IsOptional()
  GEMINI_MODEL: string = 'gemini-3.5-flash-lite';

  @IsString()
  @IsOptional()
  GEMINI_MODEL_DISPLAY_NAME: string = 'Gemini 3.5 Flash-Lite — Free Tier';

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  MAX_HISTORY_MESSAGES: number = 20;

  @IsInt()
  @Min(100)
  @Max(100000)
  @IsOptional()
  MAX_INPUT_CHARS: number = 8000;

  @IsInt()
  @Min(1000)
  @Max(200000)
  @IsOptional()
  MAX_CONTEXT_CHARS: number = 32000;

  @IsInt()
  @Min(1000)
  @IsOptional()
  RATE_LIMIT_TTL_MS: number = 60000;

  @IsInt()
  @Min(1)
  @IsOptional()
  RATE_LIMIT_MAX_REQUESTS: number = 20;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const formatted = errors
      .map((err) => {
        const constraints = err.constraints
          ? Object.values(err.constraints).join(', ')
          : 'invalid value';
        return `${err.property}: ${constraints}`;
      })
      .join('; ');
    throw new Error(`Invalid environment configuration: ${formatted}`);
  }

  return validatedConfig;
}
