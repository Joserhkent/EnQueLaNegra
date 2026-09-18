import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // Sin esto, los decoradores @IsString/@IsNotEmpty/@IsEnum de los DTOs nunca se ejecutan:
  // Nest pasa el body crudo tal cual llega. whitelist descarta props no declaradas en el DTO
  // (en vez de rechazar la request), y transform habilita la validación anidada (@Type + @ValidateNested).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Enable CORS for Desktop, Mobile & Web clients
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 3000;

  await app.listen(port, '0.0.0.0');

  console.log(`\n==================================================`);
  console.log(`🚀 API "En que la Negra POS" lista en el puerto ${port}:`);
  console.log(`👉 Local:   http://localhost:${port}`);
  console.log(`👉 Network: http://127.0.0.1:${port}`);
  console.log(`==================================================\n`);
}

bootstrap();