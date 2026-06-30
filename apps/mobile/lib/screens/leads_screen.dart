import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/leads_provider.dart';

class LeadsScreen extends StatefulWidget {
  const LeadsScreen({super.key});

  @override
  State<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends State<LeadsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => context.read<LeadsProvider>().loadLeads());
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<LeadsProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Leads'),
        actions: [
          IconButton(icon: const Icon(Icons.filter_list), onPressed: () {}),
        ],
      ),
      body: provider.loading
          ? const Center(child: CircularProgressIndicator())
          : provider.leads.isEmpty
              ? const Center(child: Text('Nenhum lead encontrado'))
              : ListView.builder(
                  itemCount: provider.leads.length,
                  padding: const EdgeInsets.all(8),
                  itemBuilder: (_, i) {
                    final lead = provider.leads[i];
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      child: ListTile(
                        title: Text(lead['name'] ?? '', maxLines: 1),
                        subtitle: Text(lead['category'] ?? ''),
                        trailing: lead['hasWhatsapp'] == true
                            ? const Icon(Icons.phone, color: Colors.green)
                            : null,
                        onTap: () => Navigator.pushNamed(context, '/lead-detail', arguments: lead),
                      ),
                    );
                  },
                ),
    );
  }
}
