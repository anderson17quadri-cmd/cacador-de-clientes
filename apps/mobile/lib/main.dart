import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'services/search_service.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/search_screen.dart';
import 'screens/leads_screen.dart';
import 'screens/lead_detail_screen.dart';
import 'screens/favorites_screen.dart';
import 'screens/settings_screen.dart';
import 'providers/auth_provider.dart';
import 'providers/search_provider.dart';
import 'providers/leads_provider.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final apiService = ApiService();
  final authService = AuthService(apiService);
  final searchService = SearchService(apiService);

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider(authService)),
        ChangeNotifierProvider(create: (_) => SearchProvider(searchService)),
        ChangeNotifierProvider(
          create: (_) => LeadsProvider(apiService),
        ),
      ],
      child: const LeadHunterApp(),
    ),
  );
}

class LeadHunterApp extends StatelessWidget {
  const LeadHunterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LeadHunter AI',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      initialRoute: '/splash',
      routes: {
        '/splash': (_) => const SplashScreen(),
        '/login': (_) => const LoginScreen(),
        '/home': (_) => const HomeScreen(),
        '/search': (_) => const SearchScreen(),
        '/leads': (_) => const LeadsScreen(),
        '/favorites': (_) => const FavoritesScreen(),
        '/settings': (_) => const SettingsScreen(),
      },
      onGenerateRoute: (settings) {
        if (settings.name == '/lead-detail') {
          final lead = settings.arguments;
          return MaterialPageRoute(
            builder: (_) => LeadDetailScreen(lead: lead),
          );
        }
        return null;
      },
    );
  }
}
