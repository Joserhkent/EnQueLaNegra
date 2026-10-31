import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Usuario para entrar: minúsculas, sin espacios (ej. «carlos» o «maria.p»)
const USUARIO = /^[a-z0-9._-]{3,30}$/;
const MENSAJE_USUARIO =
  'El usuario debe tener de 3 a 30 letras o números, sin espacios ni tildes (puede llevar . - _)';
const aUsuario = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearUsuarioDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre de la persona' })
  @MaxLength(60)
  name: string;

  @Transform(aUsuario)
  @IsString()
  @Matches(USUARIO, { message: MENSAJE_USUARIO })
  username: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72)
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Elige el rol' })
  rolId: string;

  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  @IsOptional()
  turn?: string;
}

export class ActualizarUsuarioDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre de la persona' })
  @MaxLength(60)
  @IsOptional()
  name?: string;

  @Transform(aUsuario)
  @IsString()
  @Matches(USUARIO, { message: MENSAJE_USUARIO })
  @IsOptional()
  username?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  rolId?: string;

  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  @IsOptional()
  turn?: string;

  // Desactivar en vez de borrar: las ventas pasadas siguen diciendo quién atendió
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
