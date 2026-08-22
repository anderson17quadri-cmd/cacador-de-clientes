import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      // passport-oauth2 throws at construction if these are empty, so we
      // fall back to placeholders when Google OAuth isn't configured -
      // the /auth/google routes simply fail at Google's end instead of
      // crashing the whole app on boot.
      clientID: config.get('google.clientId') || 'not-configured',
      clientSecret: config.get('google.clientSecret') || 'not-configured',
      callbackURL: `${config.get('API_URL', 'http://localhost:3001')}/api/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = {
      email: emails[0].value,
      name: name.givenName + ' ' + name.familyName,
      googleId: profile.id,
      avatarUrl: photos[0]?.value,
    };
    done(null, user);
  }
}
