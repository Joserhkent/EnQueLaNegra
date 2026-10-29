import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const MIN = 8;
const MENSAJE_MIN = `La contraseña nueva debe tener al menos ${MIN} caracteres`;

export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty()
  actual: string;

  @IsString()
  @MinLength(MIN, { message: MENSAJE_MIN })
  @MaxLength(72) // bcrypt ignora lo que pase de 72 bytes
  nueva: string;
}

export class RestablecerPasswordDto {
  @IsString()
  @MinLength(MIN, { message: MENSAJE_MIN })
  @MaxLength(72)
  nueva: string;
}
