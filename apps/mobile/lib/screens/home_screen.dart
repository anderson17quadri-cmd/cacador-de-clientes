import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/leads_provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final _pages = const [
    _DashboardTab(),
    _LeadsTab(),
    _FavoritesTab(),
    _SettingsTab(),
  ];

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      context.read<LeadsProvider>().loadStats();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('LeadHunter AI'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => Navigator.pushNamed(context, '/search'),
          ),
        ],
      ),
      body: IndexedStack(index: _currentIndex, children: _pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) => setState(() => _currentIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.people_outlined), selectedIcon: Icon(Icons.people), label: 'Leads'),
          NavigationDestination(icon: Icon(Icons.star_outlined), selectedIcon: Icon(Icons.star), label: 'Favoritos'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'Ajustes'),
        ],
      ),
    );
  }
}

class _DashboardTab extends StatelessWidget {
  const _DashboardTab();

  @override
  Widget build(BuildContext context) {
    final stats = context.watch<LeadsProvider>().stats;
    return ListView(padding: const EdgeInsets.all(16), children: [
      _StatCard(
        icon: Icons.business, label: 'Total Empresas',
        value: '${stats?['totalLeads'] ?? 0}',
        color: Colors.blue,
      ),
      const SizedBox(height: 12),
      _StatCard(
        icon: Icons.star, label: 'Leads Premium',
        value: '${stats?['premiumLeads'] ?? 0}',
        color: Colors.amber,
      ),
      const SizedBox(height: 12),
      _StatCard(
        icon: Icons.web, label: 'Sem Website',
        value: '${stats?['leadsWithoutWebsite'] ?? 0}',
        color: Colors.orange,
      ),
      const SizedBox(height: 12),
      _StatCard(
        icon: Icons.photo_camera, label: 'Sem Instagram',
        value: '${stats?['leadsWithoutInstagram'] ?? 0}',
        color: Colors.pink,
      ),
      const SizedBox(height: 24),
      SizedBox(
        height: 56,
        child: ElevatedButton.icon(
          onPressed: () => Navigator.pushNamed(context, '/search'),
          icon: const Icon(Icons.search),
          label: const Text('Nova Pesquisa', style: TextStyle(fontSize: 16)),
        ),
      ),
    ]);
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatCard({
    required this.icon, required this.label, required this.value, required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                Text(label, style: TextStyle(color: Colors.grey[400])),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LeadsTab extends StatelessWidget {
  const _LeadsTab();

  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('Acesse a tela de pesquisa para ver leads'));
  }
}

class _FavoritesTab extends StatelessWidget {
  const _FavoritesTab();

  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('Seus favoritos aparecerão aqui'));
  }
}

class _SettingsTab extends StatelessWidget {
  const _SettingsTab();

  @override
  Widget build(BuildContext context) {
    final auth = context.read<AuthProvider>();
    return ListView(padding: const EdgeInsets.all(16), children: [
      ListTile(
        leading: const CircleAvatar(child: Icon(Icons.person)),
        title: Text(auth.user?['name'] ?? 'Usuário'),
        subtitle: Text(auth.user?['email'] ?? ''),
      ),
      const Divider(),
      ListTile(
        leading: const Icon(Icons.logout, color: Colors.red),
        title: const Text('Sair'),
        onTap: () async {
          await auth.logout();
          if (context.mounted) {
            Navigator.pushReplacementNamed(context, '/login');
          }
        },
      ),
    ]);
  }
}
