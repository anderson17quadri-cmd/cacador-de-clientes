import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async localSession() {
    if (!this.config.get<boolean>('localPersonalMode', false)) {
      throw new NotFoundException('Modo pessoal local não está disponível');
    }

    const email = this.config.get<string>('localUserEmail', 'pesquisa.local@leadhunter.app');
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: 'Uso pessoal',
          defaultCountry: 'Portugal',
          emailVerified: true,
          lastLoginAt: new Date(),
        },
      });
    } else if (!user.defaultCountry || user.defaultCountry === 'Brasil') {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { defaultCountry: 'Portugal' },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken, lastLoginAt: new Date() },
    });
    return { user: this.sanitizeUser(user), ...tokens, localMode: true };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email já cadastrado');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken, lastLoginAt: new Date() },
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.password) throw new UnauthorizedException('Credenciais inválidas');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken, lastLoginAt: new Date() },
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refreshToken(token: string) {
    if (!token) throw new UnauthorizedException('Refresh token não fornecido');

    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.get('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.refreshToken !== token) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Logout realizado com sucesso' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { searches: true, favorites: true } } },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return this.sanitizeUser(user);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'Se o email existir, um link de reset será enviado' };

    const resetToken = uuid();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExp: new Date(Date.now() + 3600000),
      },
    });

    // TODO: Send email with resetToken
    return { message: 'Se o email existir, um link de reset será enviado' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: token, resetTokenExp: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('Token inválido ou expirado');

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExp: null },
    });

    return { message: 'Senha alterada com sucesso' };
  }

  async oauthLogin(profile: { email: string; name: string; googleId?: string; githubId?: string; avatarUrl?: string }) {
    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });

    if (user) {
      const updateData: any = { lastLoginAt: new Date() };
      if (profile.googleId) updateData.googleId = profile.googleId;
      if (profile.githubId) updateData.githubId = profile.githubId;
      if (profile.avatarUrl) updateData.avatarUrl = profile.avatarUrl;
      await this.prisma.user.update({ where: { id: user.id }, data: updateData });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          googleId: profile.googleId,
          githubId: profile.githubId,
          avatarUrl: profile.avatarUrl,
          emailVerified: true,
          lastLoginAt: new Date(),
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpiration', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const { password, refreshToken, resetToken, resetTokenExp, ...safe } = user;
    return safe;
  }
}
