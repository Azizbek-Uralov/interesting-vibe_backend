import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Roles } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Crypt } from '../../infrastructure/Crypt';
import { env } from '..';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleDestroy, OnModuleInit
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: env.DB_URI,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Database connected');

    await this.ensureSuperadmin();
  }

  private async ensureSuperadmin() {
    const { PHONE, PASSWORD, USERNAME, FULLNAME } = env.SUPERADMIN;

    // Bazada Superadmin mavjudligini tekshiramiz.
    const existingSuperadmin = await this.user.findFirst({
      where: { role: Roles.SUPERADMIN },
      select: { id: true },
    });
    if (existingSuperadmin) {
      console.log('Superadmin mavjud');
      return;
    }
    if (!PHONE || !PASSWORD || !USERNAME || !FULLNAME) {
      throw new Error('SUPERADMIN configuration is incomplete.');
    }

    await this.user.create({
      data: {
        phone: PHONE,
        password: await Crypt.hash(PASSWORD),
        username: USERNAME,
        fullName: FULLNAME,
        role: Roles.SUPERADMIN,
        isVerified: true,
      },
    });

    console.log('SUPERADMIN account created successfully.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Database disconnected');
  }
}
