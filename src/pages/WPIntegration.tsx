import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Terminal, ExternalLink, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
export function WPIntegration() {
  const tenant = useAuthStore(s => s.tenant);
  const siteKey = tenant?.sites?.[0]?.key || 'YOUR_SITE_KEY';
  const currentOrigin = window.location.origin;
  const pluginCode = `<?php
/**
 * Plugin Name: Mercury Messaging Widget
 * Description: Embeds the Mercury chat widget into your WordPress site.
 * Version: 1.0.0
 */
add_action('wp_footer', function() {
    $site_key = get_option('mercury_site_key', '${siteKey}');
    $queue_id = get_option('mercury_default_queue', '');
    // Inject the widget script pointing to the Mercury instance
    echo "<script src='${currentOrigin}/widget.js?siteKey={$site_key}&queueId={$queue_id}' async></script>";
});
// Admin menu for settings
add_action('admin_menu', function() {
    add_options_page('Mercury Settings', 'Mercury Messaging', 'manage_options', 'mercury-settings', function() {
        ?>
        <div class="wrap">
            <h1>Mercury Configuration</h1>
            <p>Connect your WordPress site to the Mercury Messaging platform.</p>
            <form method="post" action="options.php">
                <?php settings_fields('mercury_group'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row">Site Key</th>
                        <td><input type="text" name="mercury_site_key" value="<?php echo esc_attr(get_option('mercury_site_key')); ?>" class="regular-text" /></td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    });
});
add_action('admin_init', function() {
    register_setting('mercury_group', 'mercury_site_key');
});`;
  const copyToClipboard = () => {
    navigator.clipboard.writeText(pluginCode);
    toast.success('PHP code copied to clipboard');
  };
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 lg:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">WordPress Integration</h1>
          <p className="text-muted-foreground">Follow these steps to embed Mercury on your WordPress sites.</p>
        </div>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>PHP Plugin Skeleton</CardTitle>
                    <CardDescription>Create a new .php file in your wp-content/plugins folder.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={copyToClipboard}>
                    <Copy className="w-4 h-4" /> Copy Code
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-950 rounded-xl p-6 font-mono text-xs text-cyan-400 overflow-x-auto border border-slate-800 shadow-inner max-h-[500px]">
                  <pre>{pluginCode}</pre>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Terminal className="w-5 h-5" /> Targeted Routing</CardTitle>
                <CardDescription>How to route visitors to specific queues based on the page they are on.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed">
                  You can override the default queue by appending a <code className="bg-slate-100 px-1 rounded">queueId</code> query parameter
                  to your site's URL. Our widget automatically detects this and routes the conversation.
                </p>
                <div className="bg-slate-50 border p-4 rounded-lg font-mono text-xs text-slate-700">
                  https://your-wp-site.com/pricing/?queueId=sales-queue-123
                </div>
                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-100 text-amber-800">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-xs">
                    This is extremely useful for routing high-intent pages (Pricing, Checkout) to your Sales team,
                    while keeping standard pages on General Support.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="bg-cyan-600 text-white border-none shadow-cyan-200">
              <CardHeader>
                <CardTitle className="text-white">Quick Embed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm opacity-90">
                  Don't want to create a plugin? Just paste this snippet before the <code className="bg-white/20 px-1 rounded">{"</body>"}</code> tag in your theme.
                </p>
                <div className="bg-black/20 p-4 rounded-lg font-mono text-[10px] break-all border border-white/20">
                  {`<script src="${currentOrigin}/widget.js?siteKey=${siteKey}"></script>`}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Need Help?</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                 <Button variant="outline" className="w-full justify-start gap-2 h-12">
                   <ExternalLink className="w-4 h-4" /> Documentation
                 </Button>
                 <Button variant="outline" className="w-full justify-start gap-2 h-12">
                   <ExternalLink className="w-4 h-4" /> API Reference
                 </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}