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

  // Enable CORS for Desktop, Mobile & Web clients. La app se autentica con un
  // Bearer token (no cookies), así que no hace falta `credentials: true` — y de
  // hecho combinarlo con origin "*" es una combinación inválida que los
  // navegadores rechazan. CORS_ORIGIN permite restringir el origen en producción
  // (ej: "https://miapp.vercel.app,https://miapp.com"); sin definirla, acepta todos.
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  const port = process.env.PORT || 3000;

  await app.listen(port, '0.0.0.0');

  console.log(`\n==================================================`);
  console.log(`🚀 API "En que la Negra POS" lista en el puerto ${port}:`);
  console.log(`👉 Local:   http://localhost:${port}`);
  console.log(`👉 Network: http://127.0.0.1:${port}`);
  console.log(`==================================================\n`);
}

bootstrap().catch((err) => {
  console.error('❌ Error fatal al iniciar la API:', err);
  process.exit(1);
});
