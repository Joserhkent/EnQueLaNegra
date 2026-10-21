import { ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class JoinTablesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  tableIds: string[];
}
