import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class AuthService {
  final ApiService _api;
  final _storage = const FlutterSecureStorage();

  AuthService(this._api);

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _api.post('/auth/login', body: {
      'email': email,
      'password': password,
    });
    final data = response['data'];
    await _saveTokens(data['accessToken'], data['refreshToken']);
    await _saveUser(data['user']);
    return data;
  }

  Future<Map<String, dynamic>> register(String name, String email, String password) async {
    final response = await _api.post('/auth/register', body: {
      'name': name,
      'email': email,
      'password': password,
    });
    final data = response['data'];
    await _saveTokens(data['accessToken'], data['refreshToken']);
    await _saveUser(data['user']);
    return data;
  }

  Future<void> logout() async {
    await _storage.delete(key: 'accessToken');
    await _storage.delete(key: 'refreshToken');
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user');
  }

  Future<bool> isLoggedIn() async {
    final token = await _storage.read(key: 'accessToken');
    return token != null && token.isNotEmpty;
  }

  Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString('user');
    if (userJson == null) return null;
    return Map<String, dynamic>.from(
      Map<String, dynamic>.from(
        Map<String, dynamic>.from(
          userJson as Map,
        ),
      ),
    );
  }

  Future<void> _saveTokens(String accessToken, String refreshToken) async {
    await _storage.write(key: 'accessToken', value: accessToken);
    await _storage.write(key: 'refreshToken', value: refreshToken);
  }

  Future<void> _saveUser(Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user', user.toString());
  }
}
