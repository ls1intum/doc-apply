<#macro footer>
    <p>Diese E-Mail wurde automatisch von ${SITE_NAME!} generiert. Bitte antworte nicht auf diese Nachricht.</p>
    <#if (NOTIFICATION_SETTINGS_LINK!"")?has_content>
        <p><a href="${NOTIFICATION_SETTINGS_LINK}" style="color: #777777;">E-Mail-Benachrichtigungen verwalten</a></p>
    </#if>
</#macro>
