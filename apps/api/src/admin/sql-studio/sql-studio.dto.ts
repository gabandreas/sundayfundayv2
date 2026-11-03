import { IsNotEmpty, IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export type SqlExecutionMode = 'READ_ONLY' | 'DRY_RUN_ROLLBACK' | 'EXECUTE_COMMIT';

export class ExecuteQueryDto {
  @IsString()
  @IsNotEmpty()
  sql!: string;

  @IsOptional()
  @IsIn(['READ_ONLY', 'DRY_RUN_ROLLBACK', 'EXECUTE_COMMIT'])
  mode?: SqlExecutionMode = 'READ_ONLY';
}

export class TableRecordQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  userId?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  orderBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  orderDir?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'ASC';
}
